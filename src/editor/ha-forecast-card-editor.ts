import type { TemplateResult } from "lit";
import { LitElement, html, nothing } from "lit";
import { DEFAULT_CONFIG, compactConfig, thresholdsInOrder } from "../config";
import { EDITOR_TAG } from "../const";
import type { Translate } from "../localize";
import { createTranslator } from "../localize";
import type { HomeAssistant } from "../types/ha";
import type { AlertsConfig } from "../utils/alerts";
import { ALERT_DEFAULTS, compactAlerts } from "../utils/alerts";
import { defaultThresholds } from "../utils/temperature";
import { convertTemperature, temperatureUnit } from "../utils/units";

type Schema = Record<string, unknown>;

/**
 * Early builds stored the fields of expandable sections nested under `section_*`.
 * Hoist them back to the top level so those configs keep working and get cleaned on the next edit.
 */
function hoistSections(config: Record<string, unknown>): Record<string, unknown> {
  const sections = Object.entries(config).filter(([key]) => key.startsWith("section_"));
  const rest = Object.entries(config).filter(([key]) => !key.startsWith("section_"));
  return Object.assign({}, ...sections.map(([, value]) => (value && typeof value === "object" ? value : {})), Object.fromEntries(rest));
}

/** Visual editor built on `ha-form`; the card stays fully configurable through YAML. */
class HaForecastCardEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _draft: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: Record<string, unknown>;
  /** Form values while they are invalid: shown to the user but never saved to the card config. */
  declare _draft?: Record<string, unknown>;

  setConfig(config: Record<string, unknown>): void {
    this._config = hoistSections(config);
  }

  /** Unit thresholds are entered in: always the HA display unit. */
  private get unit() {
    return temperatureUnit(this.hass?.config.unit_system.temperature);
  }

  /** Defaults shown in the form when the user has not set a value. */
  private defaults(): Record<string, unknown> {
    const { cold, hot } = defaultThresholds(this.unit);
    return { ...DEFAULT_CONFIG, cold_threshold: cold, hot_threshold: hot };
  }

  private schema(t: Translate): Schema[] {
    const unit = this.unit;
    const range = (celsius: number) => Math.round(convertTemperature(celsius, "°C", unit));
    const threshold = (name: string): Schema => ({
      name,
      selector: {
        number: { min: range(-40), max: range(60), step: 1, mode: "box", unit_of_measurement: unit },
      },
    });
    const sensor = (name: string, deviceClass?: string): Schema => ({
      name,
      selector: { entity: { domain: "sensor", ...(deviceClass ? { device_class: deviceClass } : {}) } },
    });
    return [
      { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
      {
        type: "grid",
        name: "",
        schema: [{ name: "name", selector: { text: {} } }, { name: "show_name", selector: { boolean: {} } }],
      },
      {
        name: "default_view",
        selector: {
          select: {
            mode: "box",
            options: [
              { value: "hourly", label: t("tabs.hourly") },
              { value: "daily", label: t("tabs.daily") },
            ],
          },
        },
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "hours_to_show", selector: { number: { min: 1, max: 48, mode: "box" } } },
          { name: "days_to_show", selector: { number: { min: 1, max: 14, mode: "box" } } },
        ],
      },
      {
        type: "expandable",
        flatten: true, // keep the fields at the top level of the config (not under `section_*`)
        name: "section_sensors",
        schema: [
          sensor("temperature_entity", "temperature"),
          sensor("humidity_entity", "humidity"),
          sensor("wind_speed_entity", "wind_speed"),
          sensor("uv_index_entity"),
        ],
      },
      {
        type: "expandable",
        name: "alerts", // nested on purpose: the card reads `alerts.entities`, `alerts.min_level`...
        schema: [
          { name: "entities", selector: { entity: { multiple: true, filter: [{ domain: ["sensor", "binary_sensor"] }] } } },
          { name: "min_level", selector: { number: { min: 1, max: 4, step: 1, mode: "slider" } } },
          { name: "max_visible", selector: { number: { min: 1, max: 5, mode: "box" } } },
        ],
      },
      {
        type: "expandable",
        flatten: true, // keep the fields at the top level of the config (not under `section_*`)
        name: "section_actions",
        schema: [
          { name: "tap_action", selector: { ui_action: { default_action: "more-info" } } },
          { name: "temperature_tap_action", selector: { ui_action: { default_action: "more-info" } } },
        ],
      },
      {
        type: "expandable",
        flatten: true, // keep the fields at the top level of the config (not under `section_*`)
        name: "section_thresholds",
        schema: [{ type: "grid", name: "", schema: [threshold("cold_threshold"), threshold("hot_threshold")] }],
      },
    ];
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const t: Translate = createTranslator((this._config.language as string | undefined) ?? this.hass.language);
    const source = this._draft ?? this._config;
    const data = { ...this.defaults(), ...source };
    // While editing, an emptied number box stays empty instead of snapping back to the default.
    for (const key of ["cold_threshold", "hot_threshold"]) if (this._draft && !(key in source)) delete data[key];
    // Only entity ids go through the picker: object entries (custom adapters) are YAML-only and kept on save.
    const alerts = (data.alerts ?? {}) as Partial<AlertsConfig>;
    data.alerts = {
      ...ALERT_DEFAULTS,
      ...alerts,
      entities: (alerts.entities ?? []).filter((item): item is string => typeof item === "string"),
    };
    const invalid = !thresholdsInOrder(data.cold_threshold, data.hot_threshold);
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this.schema(t)}
        .computeLabel=${(item: { name: string }) => t(`editor.${item.name}`)}
        .computeHelper=${(item: { name: string }) => {
          const key = `editor.${item.name}_help`;
          const text = t(key);
          return text === key ? undefined : text;
        }}
        @value-changed=${this.onValueChanged}
      ></ha-form>
      ${invalid ? html`<ha-alert alert-type="error">${t("editor.threshold_order")}</ha-alert>` : nothing}
    `;
  }

  private onValueChanged(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    const { alerts, ...rest } = event.detail.value;
    const yamlOnly = ((this._config?.alerts as Partial<AlertsConfig> | undefined)?.entities ?? []).filter(
      (item) => typeof item !== "string",
    );
    const picked = alerts as Partial<AlertsConfig> | undefined;
    const merged = compactAlerts(picked ? ({ ...picked, entities: [...(picked.entities ?? []), ...yamlOnly] } as AlertsConfig) : undefined);
    const value: Record<string, unknown> = { ...rest, ...(merged ? { alerts: merged } : {}) };
    this._draft = { ...event.detail.value };
    // Invalid input stays in the form (with an error) and is not saved, so the card keeps its last valid config.
    if (!thresholdsInOrder(value.cold_threshold, value.hot_threshold)) return;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: compactConfig(value, this.defaults()) },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, HaForecastCardEditor);
}
