import type { PropertyValues, TemplateResult } from "lit";
import { LitElement, html, nothing } from "lit";
import type { ResolvedConfig } from "./config";
import { parseConfig } from "./config";
import { CARD_TAG, EDITOR_TAG } from "./const";
import { ForecastSubscription, supportsForecast } from "./controllers/forecast-subscription";
import type { Translate } from "./localize";
import { createTranslator } from "./localize";
import { cardStyles } from "./styles/card.styles";
import { tokens } from "./styles/tokens";
import type { ActionConfig, GridOptions, HassEntity, HomeAssistant } from "./types/ha";
import { isInteractive, runAction } from "./utils/actions";
import type { Formatters } from "./utils/format";
import { createFormatters } from "./utils/format";
import { cardinal, dailySlots, defined, hourlySlots } from "./utils/forecast-view";
import { LEVEL_KEYS, getLevel } from "./utils/scales";
import { resolveThresholds, temperatureColor } from "./utils/temperature";
import { convertTemperature, toCelsius, toKmh } from "./utils/units";
import type { MetricView } from "./views/attributes";
import { renderAttributes } from "./views/attributes";
import { minChartWidth, renderChart } from "./views/chart";
import { iconSprite, weatherIcon } from "./views/icons";

import "./editor/ha-forecast-card-editor";

type View = ResolvedConfig["default_view"];

class HaForecastCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _view: { state: true },
    _width: { state: true },
  };
  static override styles = [tokens, cardStyles];

  declare hass?: HomeAssistant;
  declare _config?: ResolvedConfig;
  declare _view: View;
  /** Width available to the forecast area, from a ResizeObserver. */
  declare _width: number;

  private readonly hourly = new ForecastSubscription(this);
  private readonly daily = new ForecastSubscription(this);
  private localize: Translate = createTranslator(undefined);
  private formatters: Formatters = createFormatters(undefined);
  private i18nKey: string | undefined;
  private resizeObserver?: ResizeObserver;
  private observed?: Element;

  constructor() {
    super();
    this._view = "hourly";
    this._width = 0;
  }

  // ── Card contract ──────────────────────────────────────────────────────────

  setConfig(config: unknown): void {
    this._config = parseConfig(config);
    this._view = this._config.default_view;
  }

  getCardSize(): number {
    return 6;
  }

  getGridOptions(): GridOptions {
    return { columns: 12, rows: 6, min_columns: 6, min_rows: 4 };
  }

  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    const entity = hass && Object.keys(hass.states).find((id) => id.startsWith("weather."));
    return { type: `custom:${CARD_TAG}`, entity: entity ?? "weather.home" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TAG);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.observed = undefined;
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
    const key = [language, this.hass?.locale?.time_format, this.hass?.locale?.time_zone].join("|");
    if (key !== this.i18nKey) {
      this.i18nKey = key;
      this.localize = createTranslator(language);
      this.formatters = createFormatters(language, this.hass?.locale, this.hass?.config.time_zone);
    }
    this.hourly.configure(this.hass, config.entity, "hourly");
    this.daily.configure(this.hass, config.entity, "daily");
  }

  protected override updated(): void {
    // Observe the forecast area (it only exists once data is available).
    const target = this.renderRoot.querySelector(".forecast");
    if (target === (this.observed ?? null) || typeof ResizeObserver === "undefined") return;
    this.resizeObserver ??= new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      if (width !== this._width) this._width = width;
    });
    if (this.observed) this.resizeObserver.unobserve(this.observed);
    this.observed = target ?? undefined;
    if (target) this.resizeObserver.observe(target);
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

  // ── Actions ────────────────────────────────────────────────────────────────

  private cardAction(): ActionConfig {
    return this._config?.tap_action ?? { action: "more-info" };
  }

  /** Default opens the history graph of the temperature sensor; without one, the weather entity. */
  private temperatureAction(): ActionConfig {
    const config = this._config!;
    return config.temperature_tap_action ?? { action: "more-info", entity: config.temperature_entity };
  }

  private onCardTap = (): void => {
    if (this._config && this.hass) runAction(this, this.hass, this.cardAction(), this._config.entity);
  };

  private onTemperatureTap = (event: Event): void => {
    event.stopPropagation(); // do not also trigger the card action
    if (this._config && this.hass) runAction(this, this.hass, this.temperatureAction(), this._config.entity);
  };

  private onKeydown(handler: (event: Event) => void) {
    return (event: KeyboardEvent): void => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handler(event);
      }
    };
  }

  /** Tabs/scroller live inside the card, so their events must not trigger the card action. */
  private stop = (event: Event): void => event.stopPropagation();

  private selectView(view: View): void {
    this._view = view;
  }

  // Drag-to-scroll for mouse users (touch and trackpads already scroll natively).
  private drag?: { x: number; scrollLeft: number; moved: boolean };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = event.currentTarget as HTMLElement;
    this.drag = { x: event.clientX, scrollLeft: el.scrollLeft, moved: false };
  };

  private onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const el = event.currentTarget as HTMLElement;
    const delta = event.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(delta) < 4) return; // a plain click is not a drag
      drag.moved = true;
      el.setAttribute("data-dragging", "");
      el.setPointerCapture?.(event.pointerId);
    }
    el.scrollLeft = drag.scrollLeft - delta;
  };

  private onPointerEnd = (event: PointerEvent): void => {
    if (!this.drag) return;
    const el = event.currentTarget as HTMLElement;
    this.drag = undefined;
    el.removeAttribute("data-dragging");
    if (el.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
  };

  private onScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    el.toggleAttribute("data-end", el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  protected override render(): TemplateResult | typeof nothing {
    const config = this._config;
    const weather = config && this.hass?.states[config.entity];
    if (!config || !this.hass) return nothing;

    if (!weather || weather.state === "unavailable" || weather.state === "unknown") {
      return html`<ha-card><div class="empty">${this.localize("common.unavailable")}</div></ha-card>`;
    }
    const interactive = isInteractive(this.cardAction());
    const now = new Date();
    const current = this.currentTemperature(weather);
    const thresholds = resolveThresholds(config, this.hass.config.unit_system.temperature);
    const views = this.availableViews(weather);
    const view = views.includes(this._view) ? this._view : views[0];
    const metrics = this.metrics(weather);

    return html`
      <ha-card
        class=${interactive ? "interactive" : ""}
        role=${interactive ? "button" : nothing}
        tabindex=${interactive ? 0 : nothing}
        @click=${this.onCardTap}
        @keydown=${this.onKeydown(this.onCardTap)}
      >
        ${iconSprite} ${this.renderHeader(weather, current, thresholds, now)}
        ${view ? this.renderForecast(weather, view, views, current, thresholds, now) : nothing}
        ${metrics.length ? renderAttributes(metrics) : nothing}
      </ha-card>
    `;
  }

  /** The unit the *displayed* current temperature is in (override sensor wins). */
  private temperatureUnit(weather: HassEntity): string {
    const override = this.overrideEntity(this._config?.temperature_entity);
    return (
      ((override ? override.attributes.unit_of_measurement : weather.attributes.temperature_unit) as string | undefined) ??
      this.hass!.config.unit_system.temperature
    );
  }

  private overrideEntity(id: string | undefined): HassEntity | undefined {
    return id ? this.hass!.states[id] : undefined;
  }

  private currentTemperature(weather: HassEntity): number | undefined {
    const override = this.overrideEntity(this._config?.temperature_entity);
    const raw = override ? override.state : weather.attributes.temperature;
    const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  private availableViews(weather: HassEntity): View[] {
    const features = weather.attributes.supported_features;
    const views: View[] = [];
    if (supportsForecast(features, "hourly")) views.push("hourly");
    if (supportsForecast(features, "daily")) views.push("daily");
    return views;
  }

  private conditionLabel(weather: HassEntity): string {
    const hass = this.hass!;
    return (
      hass.formatEntityState?.(weather) ||
      hass.localize?.(`component.weather.entity_component._.state.${weather.state}`) ||
      weather.state
    );
  }

  private renderHeader(
    weather: HassEntity,
    temperature: number | undefined,
    thresholds: ReturnType<typeof resolveThresholds>,
    now: Date,
  ): TemplateResult {
    const config = this._config!;
    const fmt = this.formatters;
    const unit = this.temperatureUnit(weather);
    const name = config.name ?? (weather.attributes.friendly_name as string | undefined) ?? weather.entity_id;
    const circle =
      temperature === undefined
        ? "transparent"
        : `color-mix(in srgb, ${temperatureColor(toCelsius(temperature, unit), thresholds)} 20%, transparent)`;
    const interactive = isInteractive(this.temperatureAction());
    const today = dailySlots(this.daily.forecast, now, 1, fmt, "")[0];
    const range =
      today?.isCurrent && defined(today.temperature) && defined(today.templow)
        ? `${this.localize("common.max")} ${fmt.number(today.temperature)}° · ${this.localize("common.min")} ${fmt.number(today.templow)}°`
        : undefined;

    return html`
      <div class="header">
        <div class="icon" style="--hfc-circle: ${circle}">${weatherIcon(weather.state, 38)}</div>
        <div class="info">
          ${config.show_name ? html`<span class="secondary">${name}</span>` : nothing}
          <span class="state">${this.conditionLabel(weather)}</span>
          ${range ? html`<span class="range">${range}</span>` : nothing}
        </div>
        ${temperature === undefined
          ? nothing
          : html`<div
              class="temperature ${interactive ? "interactive" : ""}"
              role=${interactive ? "button" : nothing}
              tabindex=${interactive ? 0 : nothing}
              @click=${this.onTemperatureTap}
              @keydown=${this.onKeydown(this.onTemperatureTap)}
            >
              ${fmt.number(temperature, 1)}<span class="unit">${unit}</span>
            </div>`}
      </div>
    `;
  }

  private renderForecast(
    weather: HassEntity,
    view: View,
    views: View[],
    current: number | undefined,
    thresholds: ReturnType<typeof resolveThresholds>,
    now: Date,
  ): TemplateResult {
    const config = this._config!;
    const attrs = weather.attributes;
    const forecastUnit = (attrs.temperature_unit as string | undefined) ?? this.hass!.config.unit_system.temperature;
    const precipitationUnit =
      (attrs.precipitation_unit as string | undefined) ?? this.hass!.config.unit_system.precipitation ?? "mm";
    const data = view === "hourly" ? this.hourly.forecast : this.daily.forecast;

    const slots =
      view === "hourly"
        ? hourlySlots(
            data,
            now,
            config.hours_to_show,
            this.formatters,
            {
              condition: weather.state,
              temperature:
                current === undefined ? undefined : convertTemperature(current, this.temperatureUnit(weather), forecastUnit),
            },
            this.localize("common.now"),
          )
        : dailySlots(data, now, config.days_to_show, this.formatters, this.localize("common.today"));

    const width = this._width;
    const scrollable = width > 0 && width < minChartWidth(view, slots.length);

    return html`
      ${views.length > 1
        ? html`<div class="tabs" role="group" aria-label=${this.localize("tabs.label")} @click=${this.stop} @keydown=${this.stop}>
            ${views.map(
              (v) => html`<button type="button" aria-pressed=${v === view} @click=${() => this.selectView(v)}>
                ${this.localize(`tabs.${v}`)}
              </button>`,
            )}
          </div>`
        : nothing}
      <div class="forecast" @click=${this.stop} @keydown=${this.stop}>
        ${data === undefined
          ? nothing
          : html`<div
              class="scroller ${scrollable ? "scrollable" : ""}"
              tabindex=${scrollable ? 0 : nothing}
              role=${scrollable ? "region" : nothing}
              aria-label=${scrollable ? this.localize(view === "hourly" ? "chart.scroll" : "chart.days") : nothing}
              @scroll=${this.onScroll}
              @pointerdown=${this.onPointerDown}
              @pointermove=${this.onPointerMove}
              @pointerup=${this.onPointerEnd}
              @pointercancel=${this.onPointerEnd}
            >
              ${renderChart({
                kind: view,
                slots,
                width,
                temperatureUnit: forecastUnit,
                precipitationUnit,
                thresholds,
                fmt: this.formatters,
                localize: this.localize,
              })}
            </div>`}
      </div>
    `;
  }

  private metrics(weather: HassEntity): MetricView[] {
    const config = this._config!;
    const hass = this.hass!;
    const attrs = weather.attributes;
    const fmt = this.formatters;
    const read = (id: string | undefined, fallback: unknown) => {
      const override = this.overrideEntity(id);
      const raw = override ? override.state : fallback;
      const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      return { value, unit: override?.attributes.unit_of_measurement as string | undefined };
    };
    const out: MetricView[] = [];
    const push = (metric: "humidity" | "wind" | "uv", value: number, text: string, scaled = value) => {
      const level = getLevel(metric, scaled);
      out.push({
        metric,
        value: text,
        level,
        levelLabel: this.localize(`levels.${metric}.${LEVEL_KEYS[metric][level]}`),
        name: this.localize(`attributes.${metric}`),
      });
    };

    const humidity = read(config.humidity_entity, attrs.humidity);
    if (Number.isFinite(humidity.value)) push("humidity", humidity.value, `${fmt.number(humidity.value)} %`);

    const wind = read(config.wind_speed_entity, attrs.wind_speed);
    if (Number.isFinite(wind.value)) {
      const unit =
        wind.unit ?? (attrs.wind_speed_unit as string | undefined) ?? hass.config.unit_system.wind_speed ?? "km/h";
      const bearing = cardinal(attrs.wind_bearing as number | string | undefined);
      const direction = bearing ? (hass.localize?.(`ui.card.weather.cardinal_direction.${bearing.toLowerCase()}`) || bearing) : "";
      push("wind", wind.value, `${fmt.number(wind.value, 1)} ${unit}${direction ? ` ${direction}` : ""}`, toKmh(wind.value, unit));
    }

    const uv = read(config.uv_index_entity, attrs.uv_index);
    if (Number.isFinite(uv.value)) push("uv", uv.value, fmt.number(uv.value, 1));
    return out;
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
