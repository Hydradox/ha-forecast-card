import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { HomeAssistant } from "../types/ha";
import type { ForecastEntry, ForecastEvent, ForecastType } from "../types/weather";
import { WeatherFeature } from "../types/weather";

const FEATURE_BY_TYPE: Record<ForecastType, number> = {
  daily: WeatherFeature.ForecastDaily,
  hourly: WeatherFeature.ForecastHourly,
  twice_daily: WeatherFeature.ForecastTwiceDaily,
};

export function supportsForecast(supportedFeatures: unknown, type: ForecastType): boolean {
  return typeof supportedFeatures === "number" && (supportedFeatures & FEATURE_BY_TYPE[type]) !== 0;
}

/**
 * Keeps a `weather/subscribe_forecast` websocket subscription alive for one
 * (entity, forecast type) pair. Pushes are realtime: HA emits a new event every
 * time the integration refreshes, so no polling is needed.
 */
export class ForecastSubscription implements ReactiveController {
  forecast: ForecastEntry[] | undefined;

  private unsubscribe: Promise<() => unknown> | undefined;
  private key: string | undefined;
  private connected = false;
  private hass: HomeAssistant | undefined;
  private entityId: string | undefined;
  private type: ForecastType | undefined;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    this.connected = true;
    this.sync();
  }

  hostDisconnected(): void {
    this.connected = false;
    this.teardown();
  }

  /** Call from `willUpdate`. Cheap: only (re)subscribes when entity/type/connection changes. */
  configure(hass: HomeAssistant | undefined, entityId: string, type: ForecastType): void {
    this.hass = hass;
    this.entityId = entityId;
    this.type = type;
    this.sync();
  }

  private sync(): void {
    const { hass, entityId, type } = this;
    const supported =
      hass &&
      entityId &&
      type &&
      supportsForecast(hass.states[entityId]?.attributes.supported_features, type);
    const nextKey = this.connected && supported ? `${entityId}|${type}` : undefined;

    if (nextKey === this.key) return;
    this.teardown();
    this.key = nextKey;
    if (!nextKey || !hass || !entityId || !type) return;

    const subscription = hass.connection.subscribeMessage<ForecastEvent>(
      (event) => {
        if (this.key !== nextKey) return; // stale event from a replaced subscription
        this.forecast = event.forecast ?? [];
        this.host.requestUpdate();
      },
      { type: "weather/subscribe_forecast", forecast_type: type, entity_id: entityId },
    );
    subscription.catch(() => {
      if (this.key === nextKey) this.key = undefined; // allow a retry on the next configure()
    });
    this.unsubscribe = subscription;
  }

  private teardown(): void {
    const pending = this.unsubscribe;
    this.unsubscribe = undefined;
    this.key = undefined;
    this.forecast = undefined;
    pending?.then((fn) => fn()).catch(() => undefined);
  }
}
