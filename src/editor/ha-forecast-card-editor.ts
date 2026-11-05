import type { TemplateResult } from "lit";
import { LitElement, html, nothing } from "lit";
import { EDITOR_TAG } from "../const";
import type { Translate } from "../localize";
import { createTranslator } from "../localize";
import type { HomeAssistant } from "../types/ha";

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

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const t: Translate = createTranslator(this._config.language as string | undefined ?? this.hass.language);
    const schema = [
      { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
      { name: "name", selector: { text: {} } },
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
      { name: "hours_to_show", selector: { number: { min: 1, max: 48, mode: "box" } } },
      { name: "days_to_show", selector: { number: { min: 1, max: 14, mode: "box" } } },
    ];
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${schema}
        .computeLabel=${(item: { name: string }) => t(`editor.${item.name}`)}
        @value-changed=${this.onValueChanged}
      ></ha-form>
    `;
  }

  private onValueChanged(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: event.detail.value },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, HaForecastCardEditor);
}
