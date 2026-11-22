import type { TemplateResult } from "lit";
import { LitElement, css, html, nothing, svg } from "lit";
import { DEFAULT_CONFIG, compactConfig, thresholdsInOrder } from "../config";
import type { PreviewLocationDetail } from "../const";
import { EDITOR_TAG, PREVIEW_EVENT, placesSignature } from "../const";
import type { Festivity, FestivityRule } from "../festivities/calendar";
import {
  FESTIVITIES,
  FIXED_WINDOWS,
  MOVABLE_WINDOWS,
  compactFestivityRules,
  easterSunday,
  festivityRulesValid,
  isEnabledByDefault,
  isMovable,
  parseMonthDay,
} from "../festivities/calendar";
import type { Translate } from "../localize";
import { createTranslator } from "../localize";
import type { HomeAssistant } from "../types/ha";
import type { AlertsConfig } from "../utils/alerts";
import { ALERT_DEFAULTS, compactAlerts } from "../utils/alerts";
import { memoizeOne } from "../utils/memo";
import { moveItem } from "../utils/reorder";
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

/** Default window of a festivity as a readable range ("24 Oct – 1 Nov"); movable ones are shown for this year. */
function defaultWindow(id: Festivity, language: string | undefined): string {
  const format = new Intl.DateTimeFormat(language, { day: "numeric", month: "short" });
  let from: Date;
  let to: Date;
  if (isMovable(id)) {
    const { month, day } = easterSunday(new Date().getFullYear());
    const [a, b] = MOVABLE_WINDOWS[id];
    from = new Date(new Date().getFullYear(), month - 1, day + a);
    to = new Date(new Date().getFullYear(), month - 1, day + b);
  } else {
    const [a, b] = FIXED_WINDOWS[id as keyof typeof FIXED_WINDOWS].map((value) => parseMonthDay(value) as number);
    from = new Date(2000, Math.floor(a / 100) - 1, a % 100);
    to = new Date(2000, Math.floor(b / 100) - 1, b % 100);
  }
  return `${format.format(from)} – ${format.format(to)}`;
}

/** Place of the chip an event happened on (the chip itself, or its tab button). */
const chipIndex = (event: Event): number =>
  Number((event.currentTarget as HTMLElement).closest<HTMLElement>(".chip")?.dataset.index);

const GRIP = svg`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M9 3h2v2H9zm4 0h2v2h-2zM9 7h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z" />
</svg>`;

/**
 * The form layout. Pure: built again only when one of its inputs changes (see `schemaFor`), so `ha-form` keeps
 * the same schema object across the editor's frequent `hass` updates.
 * `cameraTab`: a camera entity with the tab layout; `multiple`: the config has several places.
 */
function buildSchema(t: Translate, unit: string, cameraTab: boolean, multiple: boolean): Schema[] {
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
      name: "default_view",
      selector: {
        select: {
          mode: "box",
          options: [
            { value: "hourly", label: t("tabs.hourly") },
            { value: "daily", label: t("tabs.daily") },
            ...(cameraTab ? [{ value: "camera", label: t("tabs.camera") }] : []),
          ],
        },
      },
    },
    { name: "weather_effects", selector: { boolean: {} } },
    {
      type: "expandable",
      flatten: true, // keep the fields at the top level of the config (not under `section_*`)
      expanded: true,
      name: "section_forecast",
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            { name: "hours_to_show", selector: { number: { min: 1, max: 48, mode: "box" } } },
            { name: "days_to_show", selector: { number: { min: 1, max: 14, mode: "box" } } },
          ],
        },
      ],
    },
    {
      type: "expandable",
      flatten: true,
      expanded: true,
      name: "section_history",
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            { name: "history_hours", selector: { number: { min: 0, max: 48, mode: "box" } } },
            { name: "history_days", selector: { number: { min: 0, max: 10, mode: "box" } } },
          ],
        },
      ],
    },
    {
      type: "expandable",
      flatten: true,
      name: "section_header",
      schema: [
        { name: "name", selector: { text: {} } },
        // With several places the name line is the selector, so it cannot be hidden.
        ...(multiple ? [] : [{ name: "show_name", selector: { boolean: {} } }]),
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
        { name: "sun_entity", selector: { entity: { domain: "sun" } } },
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
      name: "section_camera",
      schema: [
        { name: "camera_entity", selector: { entity: { domain: "camera" } } },
        {
          type: "grid",
          name: "",
          schema: [{ name: "camera_name", selector: { text: {} } }, { name: "camera_refresh", selector: { number: { min: 1, max: 3600, mode: "box", unit_of_measurement: "s" } } }],
        },
        { name: "camera_tap_action", selector: { ui_action: { default_action: "more-info" } } },
        {
          name: "camera_layout",
          selector: {
            select: {
              mode: "box",
              options: [
                { value: "tab", label: t("editor.camera_layout_tab") },
                { value: "strip", label: t("editor.camera_layout_strip") },
              ],
            },
          },
        },
      ],
    },
    {
      type: "expandable",
      flatten: true, // `festivity` stays at the top level; the per-festivity rules nest under `festivities`
      name: "section_festivities",
      schema: [
        {
          name: "festivity",
          selector: {
            select: {
              mode: "dropdown",
              custom_value: true, // an entity id (e.g. an input_select) is also valid, edit it in YAML
              options: ["auto", "none", ...FESTIVITIES].map((value) => ({ value, label: t(`festivities.${value}`) })),
            },
          },
        },
        {
          type: "grid",
          name: "festivities", // nested on purpose: the card reads `festivities.<name>.{enabled,start,end}`
          schema: FESTIVITIES.map((id) => ({
            type: "expandable",
            name: id,
            schema: [
              { name: "enabled", selector: { boolean: {} } },
              isMovable(id)
                ? {
                    type: "grid",
                    name: "",
                    schema: [
                      { name: "start_offset", selector: { number: { min: -120, max: 120, step: 1, mode: "box" } } },
                      { name: "end_offset", selector: { number: { min: -120, max: 120, step: 1, mode: "box" } } },
                    ],
                  }
                : { type: "grid", name: "", schema: [{ name: "start", selector: { text: {} } }, { name: "end", selector: { text: {} } }] },
            ],
          })),
        },
      ],
    },
    {
      type: "expandable",
      flatten: true, // keep the fields at the top level of the config (not under `section_*`)
      name: "section_thresholds",
      schema: [{ type: "grid", name: "", schema: [threshold("cold_threshold"), threshold("hot_threshold")] }],
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
  ];
}

/**
 * What the form shows: the saved values (or the invalid draft) over the defaults, with every festivity listed
 * with its default window. Pure, so `dataFor` can keep the same object while nothing changes.
 */
function buildData(source: Record<string, unknown>, defaults: Record<string, unknown>, draft: boolean): Record<string, unknown> {
  const data = { ...defaults, ...source };
  // While editing, an emptied number box stays empty instead of snapping back to the default.
  for (const key of ["cold_threshold", "hot_threshold"]) if (draft && !(key in source)) delete data[key];
  // Only entity ids go through the picker: object entries (custom adapters) are YAML-only and kept on save.
  const alerts = (data.alerts ?? {}) as Partial<AlertsConfig>;
  data.alerts = {
    ...ALERT_DEFAULTS,
    ...alerts,
    entities: (alerts.entities ?? []).filter((item): item is string => typeof item === "string"),
  };
  const rules = (data.festivities ?? {}) as Record<string, FestivityRule>;
  data.festivities = Object.fromEntries(
    FESTIVITIES.map((id) => {
      const [start, end] = isMovable(id) ? MOVABLE_WINDOWS[id] : FIXED_WINDOWS[id as keyof typeof FIXED_WINDOWS];
      const window = isMovable(id) ? { start_offset: start, end_offset: end } : { start, end };
      return [id, { enabled: isEnabledByDefault(id), ...window, ...rules[id] }];
    }),
  );
  return data;
}

/** Visual editor built on `ha-form`; the card stays fully configurable through YAML. */
class HaForecastCardEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _draft: { state: true },
    _selected: { state: true },
    _dragging: { state: true },
    _ghost: { state: true },
  };

  static override styles = css`
    .locations {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--divider-color);
      border-radius: 18px;
      transition: box-shadow 0.15s;
    }
    .chip.selected {
      border-color: var(--primary-color);
      background: color-mix(in srgb, var(--primary-color) 14%, transparent);
    }
    .chip.dragging {
      border-style: dashed;
      background: transparent;
      opacity: 0.45; /* the slot the place will land in */
    }
    .locations {
      position: relative;
    }
    .chip.ghost {
      position: absolute;
      z-index: 1;
      box-sizing: border-box;
      background: var(--card-background-color, var(--primary-background-color));
      border-color: var(--primary-color);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      transform: scale(1.04);
    }
    .chip.ghost button {
      pointer-events: none;
    }
    .chip.reorderable:not(.dragging) button {
      cursor: grab;
    }
    .chip button {
      cursor: inherit;
      user-select: none;
      -webkit-user-select: none;
      min-height: 34px;
      padding: 0 14px 0 2px;
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--primary-text-color);
    }
    .chip.single button {
      padding-left: 14px;
    }
    .chip.reorderable {
      cursor: grab;
      touch-action: none; /* the finger drags the chip instead of scrolling */
    }
    .chip {
      user-select: none;
      -webkit-user-select: none;
    }
    .chip.reorderable.dragging,
    .chip.ghost {
      cursor: grabbing;
    }
    .grip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      color: var(--secondary-text-color);
    }
    .locations button.action {
      min-height: 36px;
      padding: 0 14px;
      border: 1px dashed var(--divider-color);
      border-radius: 18px;
      background: transparent;
      font: inherit;
      color: var(--primary-color);
      cursor: pointer;
    }
    .locations button.danger {
      min-height: 36px;
      padding: 0 14px;
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--error-color);
      cursor: pointer;
    }
    .locations button:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
  `;

  declare hass?: HomeAssistant;
  declare _config?: Record<string, unknown>;
  /** Form values while they are invalid: shown to the user but never saved to the card config. */
  declare _draft?: Record<string, unknown>;
  /** Place being edited when the config has `locations`. */
  declare _selected: number;
  /** Index of the place being dragged by pressing it, if any. */
  declare _dragging?: number;
  /** Floating preview of the dragged place, positioned relative to the `.locations` box. */
  declare _ghost?: { x: number; y: number; width: number; height: number };
  /** Where inside the chip the pointer grabbed it, so the preview does not jump. */
  private grab = { x: 0, y: 0 };

  constructor() {
    super();
    this._selected = 0;
  }

  /** Tells the preview card which place is being edited. */
  protected override updated(changed: Map<string, unknown>): void {
    if (this.locations.length < 2 || !(changed.has("_selected") || changed.has("_config"))) return;
    const detail: PreviewLocationDetail = { index: this._selected, signature: placesSignature(this.locations.map((place) => place.entity)), source: this };
    window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail }));
  }

  setConfig(config: Record<string, unknown>): void {
    const hoisted = hoistSections(config);
    const locations = hoisted.locations;
    this._config = Array.isArray(locations)
      ? { ...hoisted, locations: locations.map((location) => hoistSections((location ?? {}) as Record<string, unknown>)) }
      : hoisted;
    this._selected = Math.min(this._selected, Math.max(this.locations.length - 1, 0));
  }

  /** The places of the config; empty when it is a single flat one. */
  private get locations(): Record<string, unknown>[] {
    const locations = this._config?.locations;
    return Array.isArray(locations) ? (locations as Record<string, unknown>[]) : [];
  }

  /** What the form edits: the selected place, or the whole config when there is only one. */
  private get current(): Record<string, unknown> | undefined {
    return this.locations.length ? this.locations[this._selected] : this._config;
  }

  /** Card-level keys; everything else belongs to a place. */
  private static readonly CARD_KEYS = ["type", "language", "locations"];

  private emit(config: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  private cardLevel(): Record<string, unknown> {
    return Object.fromEntries(Object.entries(this._config ?? {}).filter(([key]) => key !== "locations" && HaForecastCardEditor.CARD_KEYS.includes(key)));
  }

  private placeName(place: Record<string, unknown>): string {
    const entity = place.entity as string | undefined;
    return (place.name as string | undefined) || (entity && (this.hass?.states?.[entity]?.attributes.friendly_name as string | undefined)) || entity || "?";
  }

  private addLocation = (): void => {
    if (!this._config) return;
    const used = new Set(this.locations.length ? this.locations.map((l) => l.entity) : [this._config.entity]);
    const entity = Object.keys(this.hass?.states ?? {}).find((id) => id.startsWith("weather.") && !used.has(id)) ?? "";
    const places = this.locations.length
      ? this.locations
      : [Object.fromEntries(Object.entries(this._config).filter(([key]) => !HaForecastCardEditor.CARD_KEYS.includes(key)))];
    this._selected = places.length;
    this._draft = undefined;
    this.emit({ ...this.cardLevel(), locations: [...places, { entity }] });
  };

  private removeLocation = (): void => {
    const places = this.locations.filter((_, index) => index !== this._selected);
    this._selected = Math.max(0, this._selected - 1);
    this._draft = undefined;
    // Back to one place: a plain card config again.
    this.emit(places.length === 1 ? { ...this.cardLevel(), ...places[0] } : { ...this.cardLevel(), locations: places });
  };

  /** Moves a place to a new position; the selection follows it. */
  private relocate(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.locations.length) return;
    const locations = moveItem(this.locations, from, to);
    this._selected = to;
    this._draft = undefined;
    // Update locally too: while dragging, the next move arrives before the host sends the config back.
    this._config = { ...this._config, locations };
    this.emit({ ...this.cardLevel(), locations });
  }

  /** Pointer pressed on a chip: it becomes a drag only after moving a few pixels, so a plain click still selects. */
  private pressed?: { index: number; x: number; y: number };
  /** The click that ends a drag must not also select. */
  private swallowClick = false;

  // Chip handlers are fields (stable references) and read the place from the chip's `data-index`.
  private onChipDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    this.pressed = { index: chipIndex(event), x: event.clientX, y: event.clientY };
  };

  private startDrag(event: PointerEvent, index: number): void {
    const chip = event.currentTarget as HTMLElement;
    chip.setPointerCapture(event.pointerId);
    const box = chip.getBoundingClientRect();
    this.grab = { x: event.clientX - box.left, y: event.clientY - box.top };
    this._ghost = this.ghostAt(event, box.width, box.height);
    this._dragging = index;
    this._selected = index;
    this._draft = undefined;
  }

  private ghostAt(event: PointerEvent, width: number, height: number) {
    const area = this.shadowRoot?.querySelector(".locations")?.getBoundingClientRect();
    return { x: event.clientX - (area?.left ?? 0) - this.grab.x, y: event.clientY - (area?.top ?? 0) - this.grab.y, width, height };
  }

  private onChipMove = (event: PointerEvent): void => {
    if (this._dragging === undefined) {
      const { pressed } = this;
      if (!pressed || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < 5) return;
      this.startDrag(event, pressed.index);
    }
    if (this._dragging === undefined) return;
    if (this._ghost) this._ghost = this.ghostAt(event, this._ghost.width, this._ghost.height);
    const chip = this.shadowRoot?.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".chip");
    const over = chip ? Number(chip.dataset.index) : undefined;
    if (over === undefined || Number.isNaN(over) || over === this._dragging) return;
    this.relocate(this._dragging, over);
    this._dragging = over;
  };

  private onChipUp = (): void => {
    if (this._dragging !== undefined) {
      this.swallowClick = true;
      setTimeout(() => (this.swallowClick = false));
    }
    this.pressed = undefined;
    this._dragging = undefined;
    this._ghost = undefined;
  };

  /** Keyboard alternative to dragging: arrows move the focused place, focus stays on it. */
  private onChipKey = (event: KeyboardEvent): void => {
    const index = chipIndex(event);
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (!step || this.locations.length < 2) return;
    event.preventDefault();
    this.relocate(index, index + step);
    void this.updateComplete.then(() => this.shadowRoot?.querySelector<HTMLElement>(`.chip[data-index="${index + step}"] button`)?.focus());
  };

  private onChipClick = (event: Event): void => {
    if (this.swallowClick) return;
    this._selected = chipIndex(event);
    this._draft = undefined;
  };

  private renderLocations(t: Translate): TemplateResult {
    const places = this.locations;
    const reorderable = places.length > 1;
    return html`<div class="locations" role="tablist">
      ${places.map(
        (place, index) => html`<div
          class="chip ${index === this._selected ? "selected" : ""} ${reorderable ? "reorderable" : "single"} ${index === this._dragging ? "dragging" : ""}"
          data-index=${index}
          title=${reorderable ? t("editor.reorder_location") : nothing}
          @pointerdown=${this.onChipDown}
          @pointermove=${reorderable ? this.onChipMove : nothing}
          @pointerup=${this.onChipUp}
          @pointercancel=${this.onChipUp}
          @lostpointercapture=${this.onChipUp}
          @keydown=${this.onChipKey}
        >
          ${reorderable ? html`<span class="grip" aria-hidden="true">${GRIP}</span>` : nothing}
          <button type="button" role="tab" aria-selected=${index === this._selected} @click=${this.onChipClick}>${this.placeName(place)}</button>
        </div>`,
      )}
      ${this._ghost && this._dragging !== undefined
        ? html`<div class="chip ghost" aria-hidden="true" style="left:${this._ghost.x}px;top:${this._ghost.y}px;width:${this._ghost.width}px;height:${this._ghost.height}px">
            <span class="grip">${GRIP}</span>
            <button type="button" tabindex="-1">${this.placeName(places[this._dragging] ?? {})}</button>
          </div>`
        : nothing}
      <button type="button" class="action" @click=${this.addLocation}>+ ${t("editor.add_location")}</button>
      ${places.length ? html`<button type="button" class="danger" @click=${this.removeLocation}>${t("editor.remove_location")}</button>` : nothing}
    </div>`;
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

  // `hass` changes with every state change in HA and re-renders the editor: everything handed to `ha-form`
  // is memoized on its real inputs, so the form only sees `hass` change.
  private translator = memoizeOne((language: string | undefined) => createTranslator(language));
  private schemaFor = memoizeOne(buildSchema);
  private dataFor = memoizeOne((source: Record<string, unknown>, unit: string, draft: boolean) => {
    const { cold, hot } = defaultThresholds(unit);
    return buildData(source, { ...DEFAULT_CONFIG, cold_threshold: cold, hot_threshold: hot }, draft);
  });
  private labelFor = memoizeOne((t: Translate, language: string | undefined) => {
    const windows = new Map(FESTIVITIES.map((id) => [id as string, defaultWindow(id, language)]));
    return (item: { name: string }): string =>
      windows.has(item.name) ? `${t(`festivities.${item.name}`)} · ${windows.get(item.name)}` : t(`editor.${item.name}`);
  });
  private helperFor = memoizeOne((t: Translate) => (item: { name: string }): string | undefined => {
    const key = `editor.${item.name}_help`;
    const text = t(key);
    return text === key ? undefined : text;
  });

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const language = (this._config.language as string | undefined) ?? this.hass.language;
    const t = this.translator(language);
    const source = this._draft ?? this.current ?? {};
    const data = this.dataFor(source, this.unit, !!this._draft);
    // The camera is a tab only with a camera entity and the tab layout.
    const cameraTab = !!source.camera_entity && source.camera_layout !== "strip";
    const invalid = !thresholdsInOrder(data.cold_threshold, data.hot_threshold);
    const badDates = !festivityRulesValid(data.festivities);
    return html`
      ${this.renderLocations(t)}
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this.schemaFor(t, this.unit, cameraTab, this.locations.length > 1)}
        .computeLabel=${this.labelFor(t, language)}
        .computeHelper=${this.helperFor(t)}
        @value-changed=${this.onValueChanged}
      ></ha-form>
      ${invalid ? html`<ha-alert alert-type="error">${t("editor.threshold_order")}</ha-alert>` : nothing}
      ${badDates ? html`<ha-alert alert-type="error">${t("editor.festivity_dates_invalid")}</ha-alert>` : nothing}
    `;
  }

  private onValueChanged(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    const { alerts, festivities, ...rest } = event.detail.value;
    const yamlOnly = ((this.current?.alerts as Partial<AlertsConfig> | undefined)?.entities ?? []).filter(
      (item) => typeof item !== "string",
    );
    const picked = alerts as Partial<AlertsConfig> | undefined;
    const merged = compactAlerts(picked ? ({ ...picked, entities: [...(picked.entities ?? []), ...yamlOnly] } as AlertsConfig) : undefined);
    const rules = compactFestivityRules(festivities as Parameters<typeof compactFestivityRules>[0]);
    const value: Record<string, unknown> = { ...rest, ...(merged ? { alerts: merged } : {}), ...(rules ? { festivities: rules } : {}) };
    this._draft = { ...event.detail.value };
    // Invalid input stays in the form (with an error) and is not saved, so the card keeps its last valid config.
    if (!thresholdsInOrder(value.cold_threshold, value.hot_threshold) || !festivityRulesValid(festivities)) return;
    const compact = compactConfig(value, this.defaults());
    if (!this.locations.length) return this.emit(compact);
    const locations = this.locations.map((place, index) => (index === this._selected ? compact : place));
    this.emit({ ...this.cardLevel(), locations });
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, HaForecastCardEditor);
}
