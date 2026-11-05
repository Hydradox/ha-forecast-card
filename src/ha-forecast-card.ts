import type { PropertyValues, TemplateResult } from "lit";
import { LitElement, html, nothing } from "lit";
import type { ResolvedConfig } from "./config";
import { parseConfig } from "./config";
import { CARD_TAG, EDITOR_TAG } from "./const";
import { ForecastSubscription } from "./controllers/forecast-subscription";
import type { Translate } from "./localize";
import { createTranslator } from "./localize";
import { cardStyles } from "./styles/card.styles";
import { tokens } from "./styles/tokens";
import type { GridOptions, HassEntity, HomeAssistant } from "./types/ha";
import type { ForecastType } from "./types/weather";
import { temperatureColor } from "./utils/temperature";
import { toCelsius } from "./utils/units";

import "./editor/ha-forecast-card-editor";

const VIEW_TO_FORECAST: Record<ResolvedConfig["default_view"], ForecastType> = {
  hourly: "hourly",
  daily: "daily",
};

class HaForecastCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _view: { state: true },
  };
  static override styles = [tokens, cardStyles];

  declare hass?: HomeAssistant;
  declare _config?: ResolvedConfig;
  declare _view: ResolvedConfig["default_view"];

  private readonly forecast = new ForecastSubscription(this);
  private localize: Translate = createTranslator(undefined);
  private translateLanguage: string | undefined;

  constructor() {
    super();
    this._view = "hourly";
  }

  // ── Card contract ──────────────────────────────────────────────────────────

  setConfig(config: unknown): void {
    this._config = parseConfig(config);
    this._view = this._config.default_view;
  }

  getCardSize(): number {
    return 5;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 5, min_columns: 6, min_rows: 4 };
  }

  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    const entity = hass && Object.keys(hass.states).find((id) => id.startsWith("weather."));
    return { type: `custom:${CARD_TAG}`, entity: entity ?? "weather.home" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TAG);
  }

  // ── Update pipeline ────────────────────────────────────────────────────────

  /** `hass` changes on every state change in HA: only re-render when our entities changed. */
  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!this._config) return false;
    if (changed.size !== 1 || !changed.has("hass")) return true;

    const previous = changed.get("hass") as HomeAssistant | undefined;
    if (!previous || !this.hass) return true;
    if (previous.language !== this.hass.language) return true;
    return this.watchedEntities().some((id) => previous.states[id] !== this.hass!.states[id]);
  }

  protected override willUpdate(): void {
    const config = this._config;
    if (!config) return;
    const language = config.language ?? this.hass?.locale?.language ?? this.hass?.language;
    if (language !== this.translateLanguage) {
      this.translateLanguage = language;
      this.localize = createTranslator(language);
    }
    this.forecast.configure(this.hass, config.entity, VIEW_TO_FORECAST[this._view]);
  }

  private watchedEntities(): string[] {
    const c = this._config;
    if (!c) return [];
    return [
      c.entity,
      c.temperature_entity,
      c.humidity_entity,
      c.wind_speed_entity,
      c.uv_index_entity,
    ].filter((id): id is string => !!id);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  protected override render(): TemplateResult | typeof nothing {
    const config = this._config;
    const weather = config && this.hass?.states[config.entity];
    if (!config || !this.hass) return nothing;

    if (!weather || weather.state === "unavailable" || weather.state === "unknown") {
      return html`<ha-card><div class="empty">${this.localize("common.unavailable")}</div></ha-card>`;
    }
    return html`<ha-card>${this.renderHeader(weather)}</ha-card>`;
  }

  private renderHeader(weather: HassEntity): TemplateResult {
    const config = this._config!;
    const attrs = weather.attributes;
    const unit = (attrs.temperature_unit as string | undefined) ?? this.hass!.config.unit_system.temperature;
    const override = config.temperature_entity && this.hass!.states[config.temperature_entity];
    const raw = override ? Number(override.state) : Number(attrs.temperature);
    const temperature = Number.isFinite(raw) ? raw : undefined;
    const name = config.name ?? (attrs.friendly_name as string | undefined) ?? weather.entity_id;
    const circle =
      temperature === undefined
        ? "transparent"
        : `color-mix(in srgb, ${temperatureColor(toCelsius(temperature, unit))} 20%, transparent)`;
    const format = new Intl.NumberFormat(this.translateLanguage, { maximumFractionDigits: 1 });

    return html`
      <div class="header">
        <div class="icon" style="--hfc-circle: ${circle}"></div>
        <div class="info">
          <span class="secondary">${name}</span>
          <span class="state">${weather.state}</span>
        </div>
        ${temperature === undefined
          ? nothing
          : html`<div class="temperature">${format.format(temperature)}<span class="unit">${unit}</span></div>`}
      </div>
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, HaForecastCard);
}

console.info(
  `%c FORECAST AT GLANCE %c v${__VERSION__} `,
  "color:white;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:white;font-weight:700",
);

window.customCards = window.customCards ?? [];
if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Forecast at glance",
    description: "Weather forecast preview with key weather attributes",
    preview: true,
  });
}
