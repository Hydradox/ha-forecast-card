import type { TemplateResult } from "lit";
import { LitElement, html, nothing } from "lit";
import { DEFAULT_CONFIG, compactConfig } from "../config";
import { EDITOR_TAG } from "../const";
import type { Translate } from "../localize";
import { createTranslator } from "../localize";
import type { HomeAssistant } from "../types/ha";
import { defaultThresholds } from "../utils/temperature";
import { convertTemperature, temperatureUnit } from "../utils/units";

type Schema = Record<string, unknown>;

/** Visual editor built on `ha-form`; the card stays fully configurable through YAML. */
class HaForecastCardEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: Record<string, unknown>;

  setConfig(config: Record<string, unknown>): void {
    this._config = config;
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
        name: "section_colors",
        schema: [{ type: "grid", name: "", schema: [threshold("cold_threshold"), threshold("hot_threshold")] }],
      },
      {
        type: "expandable",
        name: "section_actions",
        schema: [
          { name: "tap_action", selector: { ui_action: { default_action: "more-info" } } },
          { name: "temperature_tap_action", selector: { ui_action: { default_action: "more-info" } } },
        ],
      },
    ];
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const t: Translate = createTranslator((this._config.language as string | undefined) ?? this.hass.language);
    const data = { ...this.defaults(), ...this._config };
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
    `;
  }

  private onValueChanged(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: compactConfig(event.detail.value, this.defaults()) },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, HaForecastCardEditor);
}
