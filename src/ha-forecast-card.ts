import type { PropertyValues, TemplateResult } from "lit";
import { LitElement, html, nothing } from "lit";
import type { ResolvedConfig } from "./config";
import type { ForecastView } from "./config";
import { parseLocations } from "./config";
import type { PreviewLocationDetail } from "./const";
import { CARD_TAG, EDITOR_TAG, PREVIEW_EVENT, placesSignature } from "./const";
import { ForecastSubscription, supportsForecast } from "./controllers/forecast-subscription";
import { CameraRefresh } from "./controllers/camera-refresh";
import { ClockController } from "./controllers/clock";
import { HistoryController } from "./controllers/history";
import type { Translate } from "./localize";
import { createTranslator } from "./localize";
import { effectStyles } from "./effects/effects.styles";
import { resolveFestivity } from "./festivities/calendar";
import type { Festivity } from "./festivities/calendar";
import { renderFestivityBrand, renderFestivityLayers } from "./festivities/render";
import { festivityStyles } from "./festivities/styles";
import { renderWeatherEffect } from "./effects/render";
import { cardStyles } from "./styles/card.styles";
import { tokens } from "./styles/tokens";
import type { ActionConfig, GridOptions, HassEntity, HomeAssistant } from "./types/ha";
import { isInteractive, runAction } from "./utils/actions";
import type { WeatherAlert } from "./utils/alerts";
import { ALERT_DEFAULTS, alertSources, collectAlerts, formatWindow } from "./utils/alerts";
import type { Formatters } from "./utils/format";
import { createFormatters } from "./utils/format";
import { cardinal, dailySlots, defined, hourlySlots } from "./utils/forecast-view";
import { pastDailySlots, pastSlots as pastHourlySlots, toPoints } from "./utils/history";
import { cameraFrame, hasCamera } from "./utils/camera";
import { dialogOf } from "./utils/dom";
import { ensureCameraStream, supportsStream } from "./utils/camera-stream";
import { LEVEL_KEYS, getLevel } from "./utils/scales";
import { readSunSources, sunChanged, withDaylight } from "./utils/sun";
import { resolveThresholds } from "./utils/temperature";
import { convertTemperature, toKmh } from "./utils/units";
import { renderAlerts } from "./views/alerts";
import { renderCameraPanel, renderCameraStrip } from "./views/camera";
import type { MetricView } from "./views/attributes";
import { renderAttributes } from "./views/attributes";
import { isActivation } from "./views/keyboard";
import { isScrollable, pastCount, renderChart } from "./views/chart";
import { iconSprite, weatherIcon } from "./views/icons";

import "./editor/ha-forecast-card-editor";

type View = ForecastView;
/** Forecast views plus the camera tab (layout `tab`). */
type Tab = View | "camera";
/** The chart or camera panel that slides when the tab changes (the ghost copy is excluded). */
/** Fade of the location list; keep in sync with `picker-out` in `card.styles.ts`. */
const PICKER_FADE_MS = 250;
const SLIDE_CONTENT = ".scroller:not(.ghost), .cam-panel:not(.ghost)";

class HaForecastCard extends LitElement {
  static override properties = {
    hass: { attribute: false },
    preview: { attribute: false },
    _config: { state: true },
    _index: { state: true },
    _pickerOpen: { state: true },
    _pickerLeaving: { state: true },
    _view: { state: true },
    _width: { state: true },
    _alertsOpen: { state: true },
    _cameraOpen: { state: true },
    _cameraFailed: { state: true },
    _streamReady: { state: true },
  };
  static override styles = [tokens, cardStyles, effectStyles, festivityStyles];

  declare hass?: HomeAssistant;
  /** Set by Home Assistant on the card shown next to the editor (and in the card picker). */
  declare preview?: boolean;
  /** The place being shown (one of `locations`); the others stay idle: no subscriptions, history or camera. */
  declare _config?: ResolvedConfig;
  declare _index: number;
  /** Location selector open. */
  declare _pickerOpen: boolean;
  /** The list stays mounted while it fades out. */
  declare _pickerLeaving: boolean;
  private pickerTimer?: ReturnType<typeof setTimeout>;
  private locations: ResolvedConfig[] = [];
  declare _view: Tab;
  /** Width available to the forecast area, from a ResizeObserver. */
  declare _width: number;
  /** Alert list expanded (all alerts with descriptions) or collapsed (the most severe ones). */
  declare _alertsOpen: boolean;
  /** Camera strip expanded (layout `strip`). */
  declare _cameraOpen: boolean;
  /** URL of the camera image that failed to load; a new refresh gives a new URL and retries. */
  declare _cameraFailed?: string;
  /** `ha-camera-stream` (the HA player) is available. */
  declare _streamReady: boolean;
  private streamRequested = false;

  private readonly hourly = new ForecastSubscription(this);
  private readonly daily = new ForecastSubscription(this);
  private readonly history = new HistoryController(this);
  private readonly cameraRefresh = new CameraRefresh(this);
  /** What the hourly scroller was last positioned for (see `alignToNow`). */
  private alignedKey?: string;
  private localize: Translate = createTranslator(undefined);
  private formatters: Formatters = createFormatters(undefined);
  private i18nKey: string | undefined;
  private activeAlerts: WeatherAlert[] = [];
  private festivity?: Festivity;
  /** Clock reading shared by everything drawn in one update. */
  private now = new Date();
  /** View drawn by the current update (worked out in `willUpdate`), and the one before it (to slide when the tab changes). */
  private renderedView?: Tab;
  private shownView?: Tab;
  /** Copy of the chart being replaced, kept to slide it out. */
  private outgoing?: { node: HTMLElement; height: number; scrollLeft: number };
  private slides: Animation[] = [];
  private resizeObserver?: ResizeObserver;
  private observed?: Element;
  private visibility?: IntersectionObserver;

  constructor() {
    super();
    new ClockController(this); // time-based content follows the clock, not only entity changes
    this._view = "hourly";
    this._index = 0;
    this._pickerOpen = false;
    this._pickerLeaving = false;
    this._width = 0;
    this._alertsOpen = false;
    this._cameraOpen = false;
    this._streamReady = false;
  }

  // ── Card contract ──────────────────────────────────────────────────────────

  setConfig(config: unknown): void {
    this.locations = parseLocations(config);
    this._index = Math.min(this._index, this.locations.length - 1); // the editor re-sends the config on every edit
    // A selection the editor announced before this config (reorder, add, remove) arrives with it.
    if (this.pendingPreview && this.pendingPreview.signature === this.signature()) {
      this._index = Math.min(this.pendingPreview.index, this.locations.length - 1);
      this.pendingPreview = undefined;
    }
    this._config = this.locations[this._index];
    this._view = this._config.default_view;
  }

  getCardSize(): number {
    // Each visible alert row is about one grid row; the expanded list is capped by its scroll area.
    const alerts = this.activeAlerts.length;
    const visible = this._alertsOpen ? Math.min(alerts, 3) : Math.min(alerts, this._config?.alerts?.max_visible ?? ALERT_DEFAULTS.max_visible);
    return 6 + visible;
  }

  getGridOptions(): GridOptions {
    // Content-sized: a fixed row count overflows the tile (hourly and daily differ in height).
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    const entity = hass && Object.keys(hass.states).find((id) => id.startsWith("weather."));
    return { type: `custom:${CARD_TAG}`, entity: entity ?? "weather.home" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TAG);
  }

  private pendingPreview?: PreviewLocationDetail;

  private signature(): string {
    return placesSignature(this.locations.map((place) => place.entity));
  }

  /**
   * The editor selected a place: show it here when this card is the editor's preview and has the same places.
   * HA sets `preview` on every card while the dashboard is in edit mode, so the card must also sit in the
   * editor's dialog: dashboard cards (also the one behind the dialog) keep their own selection.
   */
  private onPreviewLocation = (event: Event): void => {
    const detail = (event as CustomEvent<PreviewLocationDetail>).detail;
    if (!this.preview) return;
    const dialog = dialogOf(this);
    if (!dialog || (detail.source && dialogOf(detail.source) !== dialog)) return;
    if (!this.locations || detail.signature !== this.signature()) {
      this.pendingPreview = detail; // the matching config may still be on its way
      return;
    }
    this.pendingPreview = undefined;
    this.selectLocation(detail.index);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(PREVIEW_EVENT, this.onPreviewLocation);
    // Effects only animate while the card is on screen.
    if (typeof IntersectionObserver !== "undefined") {
      this.visibility ??= new IntersectionObserver(([entry]) => this.toggleAttribute("data-fx-paused", !entry.isIntersecting));
      this.visibility.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(PREVIEW_EVENT, this.onPreviewLocation);
    this.visibility?.disconnect();
    this.closePicker();
    clearTimeout(this.pickerTimer);
    this._pickerLeaving = false; // no fade while detached
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
    if (previous.themes?.darkMode !== this.hass.themes?.darkMode) return true;
    const { sun_entity, sunrise_entity, sunset_entity } = this._config;
    return this.watchedEntities().some((id) =>
      id === sun_entity || id === sunrise_entity || id === sunset_entity ? sunChanged(previous.states[id], this.hass!.states[id]) : previous.states[id] !== this.hass!.states[id],
    );
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
    // Everything time-based in this update reads the same clock.
    const now = (this.now = new Date());
    this.activeAlerts = this.hass ? collectAlerts(this.hass.states, config.alerts, now) : [];
    this.renderedView = this.visibleTab();
    // Seasonal decoration: palette tokens live on the host (see festivities/styles.ts).
    this.festivity = resolveFestivity(config.festivity, (id) => this.hass?.states[id]?.state, now, config.festivities);
    this.toggleAttribute("data-dark", !!this.hass?.themes?.darkMode);
    if (this.festivity) this.setAttribute("data-festivity", this.festivity);
    else this.removeAttribute("data-festivity");
    // Live stream while the camera is on screen (the strip only when expanded); otherwise a reloaded still.
    const onScreen = config.camera_layout === "strip" ? this._cameraOpen : this._view === "camera";
    const live = this.cameraLive();
    if (live === "pending" && !this.streamRequested && config.camera_entity) {
      this.streamRequested = true;
      void ensureCameraStream(config.camera_entity).then((ready) => {
        this._streamReady = ready;
        if (!ready) this.streamRequested = false; // retry on a later render
      });
    }
    this.cameraRefresh.configure(
      hasCamera(config) && (config.camera_layout === "strip" || this._view === "camera") && !(onScreen && live === true),
      config.camera_refresh,
    );
    this.hourly.configure(this.hass, config.entity, "hourly");
    this.daily.configure(this.hass, config.entity, "daily");
    this.history.configure(
      this.hass,
      [config.entity, config.temperature_entity].filter((id): id is string => !!id),
      // Window covering both views: the hours back, and whole days (plus today, for the day boundary).
      Math.max(config.history_hours, config.history_days > 0 ? (config.history_days + 1) * 24 : 0),
      now,
    );
  }

  /**
   * Tab change: the old chart slides out while the new one slides in, and the area eases to the new
   * height so the content below does not jump. Skipped on first paint and with reduced motion.
   */
  private slideForecast(): void {
    const previous = this.shownView;
    this.shownView = this.renderedView;
    const outgoing = this.outgoing;
    this.outgoing = undefined;
    if (!previous || !this.renderedView || previous === this.renderedView) return;
    const forecast = this.renderRoot.querySelector<HTMLElement>(".forecast");
    const scroller = forecast?.querySelector<HTMLElement>(SLIDE_CONTENT);
    if (!forecast || !scroller || typeof scroller.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    this.slides.forEach((animation) => animation.cancel()); // a quick second click restarts cleanly
    const batch: Animation[] = (this.slides = []);
    forecast.querySelectorAll(".ghost").forEach((node) => node.remove());

    const order: Tab[] = ["hourly", "daily", "camera"];
    const offset = order.indexOf(this.renderedView) > order.indexOf(previous) ? 32 : -32;
    const timing = { duration: 250, easing: "ease-out" } as const;
    const finishers: (() => void)[] = [];
    forecast.toggleAttribute("data-sliding", true); // clips the travel to the card

    batch.push(
      scroller.animate(
        [
          { opacity: 0, transform: `translateX(${offset}px)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        timing,
      ),
    );
    if (outgoing) {
      const { node, height, scrollLeft } = outgoing;
      forecast.append(node);
      node.scrollLeft = scrollLeft;
      batch.push(
        node.animate(
          [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: `translateX(${-offset}px)` },
          ],
          { duration: 50, easing: "ease-out", fill: "forwards" }, // gone almost at once; stays hidden until removed
        ),
      );
      finishers.push(() => node.remove());
      const target = forecast.getBoundingClientRect().height;
      if (Math.abs(target - height) > 1) {
        batch.push(forecast.animate([{ height: `${height}px` }, { height: `${target}px` }], timing));
      }
    }
    const done = () => {
      if (batch.some((animation) => animation.playState === "running")) return;
      finishers.forEach((finish) => finish());
      // A newer slide owns the flag; a stale batch (cancel events arrive late) must not clear it.
      if (batch === this.slides) forecast.toggleAttribute("data-sliding", false);
    };
    for (const animation of batch) {
      animation.addEventListener("finish", done);
      animation.addEventListener("cancel", done);
    }
  }

  /**
   * Recorded hours sit to the left of "Now": open the hourly chart scrolled so "Now" is the first visible
   * column. Only when the layout changes, so a user who scrolled back is not pulled forward again.
   */
  private alignToNow(): void {
    const scroller = this.renderRoot.querySelector<HTMLElement>(".scroller:not(.ghost)");
    const grid = scroller?.querySelector<HTMLElement>(".grid");
    if (!scroller || !grid) return;
    const past = Number(scroller.dataset.past ?? 0);
    const column = parseFloat(grid.style.getPropertyValue("--col")) || 0;
    const key = `${this.renderedView}|${past}|${Math.round(this._width)}`;
    if (key === this.alignedKey) return;
    this.alignedKey = key;
    scroller.scrollLeft = past ? column * past : 0;
    this.syncEdges(scroller);
  }

  protected override updated(): void {
    this.alignToNow();
    this.slideForecast();
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
    // The other places are only read (condition and temperature) while the selector is open.
    const others = this._pickerOpen
      ? this.locations.flatMap((location, index) => (index === this._index ? [] : [location.entity, location.temperature_entity]))
      : [];
    return [
      ...others,
      c.entity,
      c.temperature_entity,
      c.humidity_entity,
      c.wind_speed_entity,
      c.uv_index_entity,
      c.sun_entity,
      c.sunrise_entity,
      c.sunset_entity,
      c.camera_entity,
      c.festivity?.includes(".") ? c.festivity : undefined,
      ...alertSources(c.alerts).map((source) => source.entity),
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

  // Handlers are fields (stable references), so re-renders do not swap listeners. Clicks and keys share them.

  private onCardTap = (event: Event): void => {
    if (!isActivation(event)) return;
    if (this._config && this.hass) runAction(this, this.hass, this.cardAction(), this._config.entity);
  };

  private onTemperatureTap = (event: Event): void => {
    if (!isActivation(event)) return;
    event.stopPropagation(); // do not also trigger the card action
    if (this._config && this.hass) runAction(this, this.hass, this.temperatureAction(), this._config.entity);
  };

  /** More-info (history) of a custom sensor shown in the strip; the sensor is the metric's `data-entity`. */
  private onMetric = (event: Event): void => {
    if (!isActivation(event)) return;
    const entity = (event.currentTarget as HTMLElement).dataset.entity;
    if (entity && this.hass) runAction(this, this.hass, { action: "more-info", entity }, entity);
  };

  private onTab = (event: Event): void => {
    this.selectView((event.currentTarget as HTMLElement).dataset.tab as Tab);
  };

  private onPickerOption = (event: Event): void => {
    this.selectLocation(Number((event.currentTarget as HTMLElement).dataset.index));
  };

  /** Tabs/scroller live inside the card, so their events must not trigger the card action. */
  private stop = (event: Event): void => event.stopPropagation();

  private toggleAlerts = (): void => {
    if (window.getSelection?.()?.toString()) return; // selecting text in a row must not collapse it
    this._alertsOpen = !this._alertsOpen;
  };

  private selectLocation(index: number): void {
    this.closePicker();
    if (index === this._index || !this.locations[index]) return;
    this._index = index;
    this._config = this.locations[index];
    this._view = this._config.default_view;
    // Nothing of the previous place carries over: the subscriptions follow the new entity in `willUpdate`.
    this.outgoing = undefined;
    this.alignedKey = undefined;
    this._alertsOpen = false;
    this._cameraOpen = false;
    this._cameraFailed = undefined;
  }

  private togglePicker = (): void => {
    if (this._pickerOpen) return this.closePicker();
    clearTimeout(this.pickerTimer);
    this._pickerLeaving = false;
    this._pickerOpen = true;
    // Capture phase: runs before the card's own tap action; outside clicks and Escape close the list.
    document.addEventListener("pointerdown", this.onOutside, true);
    document.addEventListener("keydown", this.onPickerKey, true);
  };

  private closePicker(): void {
    document.removeEventListener("pointerdown", this.onOutside, true);
    document.removeEventListener("keydown", this.onPickerKey, true);
    if (!this._pickerOpen) return;
    this._pickerOpen = false;
    // Fade out (same duration as the CSS), unless the user prefers no motion.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    this._pickerLeaving = true;
    this.pickerTimer = setTimeout(() => (this._pickerLeaving = false), PICKER_FADE_MS);
  }

  private onOutside = (event: Event): void => {
    if (!event.composedPath().some((node) => node instanceof HTMLElement && node.classList.contains("picker"))) this.closePicker();
  };

  private onPickerKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    this.closePicker();
    this.renderRoot.querySelector<HTMLElement>(".picker-button")?.focus();
  };

  private selectView(view: Tab): void {
    if (view !== this._view) this.captureOutgoing();
    this._view = view;
  }

  private toggleCamera = (): void => {
    this._cameraOpen = !this._cameraOpen;
  };

  /** Default: the live view of the camera entity (more-info). */
  private cameraAction(): ActionConfig {
    const config = this._config!;
    if (config.camera_tap_action) return config.camera_tap_action;
    return { action: "more-info", entity: config.camera_entity };
  }

  private cameraOpener(): (() => void) | undefined {
    return isInteractive(this.cameraAction()) ? this.openCamera : undefined;
  }

  private openCamera = (): void => {
    if (this._config && this.hass) runAction(this, this.hass, this.cameraAction(), this._config.camera_entity ?? this._config.entity);
  };

  private onCameraError = (url: string): void => {
    this._cameraFailed = url;
  };

  private onCameraLoad = (): void => {
    if (this._cameraFailed !== undefined) this._cameraFailed = undefined;
  };

  /** Whether the live player applies: true, "pending" while it loads, false (still image). */
  private cameraLive(): boolean | "pending" {
    const config = this._config;
    if (!config?.camera_entity) return false;
    if (!supportsStream(this.hass?.states[config.camera_entity]?.attributes)) return false;
    return this._streamReady ? true : "pending";
  }

  /** What the camera currently shows, shared by both layouts. */
  private cameraView() {
    const config = this._config!;
    const hass = this.hass!;
    const state = config.camera_entity ? hass.states[config.camera_entity] : undefined;
    const live = this.cameraLive() === true && (config.camera_layout === "strip" ? this._cameraOpen : true);
    const frame = cameraFrame(config, state, this.cameraRefresh.stamp, (path) =>
      hass.hassUrl ? hass.hassUrl(path) : path,
    );
    return {
      frame,
      label: frame.name ?? this.localize("camera.label"),
      failed: frame.url !== undefined && frame.url === this._cameraFailed,
      onLoad: this.onCameraLoad,
      onError: this.onCameraError,
      localize: this.localize,
      stream: live && state && state.state !== "unavailable" ? { hass, stateObj: state } : undefined,
    };
  }

  /** Called right before the view changes, while the old chart is still in the DOM. */
  private captureOutgoing(): void {
    const forecast = this.renderRoot.querySelector<HTMLElement>(".forecast");
    const scroller = forecast?.querySelector<HTMLElement>(SLIDE_CONTENT);
    if (!forecast || !scroller) {
      this.outgoing = undefined;
      return;
    }
    const node = scroller.cloneNode(true) as HTMLElement;
    node.classList.add("ghost");
    node.removeAttribute("tabindex");
    node.removeAttribute("role");
    node.setAttribute("aria-hidden", "true");
    node.setAttribute("inert", "");
    this.outgoing = { node, height: forecast.getBoundingClientRect().height, scrollLeft: scroller.scrollLeft };
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
    this.syncEdges(event.currentTarget as HTMLElement);
  }

  private syncEdges(el: HTMLElement): void {
    el.toggleAttribute("data-start", el.scrollLeft <= 2);
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
    const now = this.now;
    const current = this.currentTemperature(weather);
    const thresholds = resolveThresholds(config, this.hass.config.unit_system.temperature);
    const camera = hasCamera(config);
    const tabs = this.tabs(weather);
    const view = this.renderedView;
    const metrics = this.metrics(weather);
    const dark = !!this.hass.themes?.darkMode;

    return html`
      <ha-card>
        ${config.weather_effects ? renderWeatherEffect(weather.state, dark) : nothing} ${renderFestivityLayers(this.festivity, dark)} ${iconSprite} ${this.renderHeader(weather, current, now, dark)} ${this.renderAlertBanner(now)}
        ${camera && config.camera_layout === "strip" ? this.renderCameraStrip() : nothing}
        ${this.renderTabs(tabs, view)}
        ${view === "camera"
          ? this.renderCameraTab()
          : view
            ? this.renderForecast(weather, view, current, thresholds, now)
            : nothing}
        ${metrics.length ? renderAttributes(metrics, this.onMetric) : nothing}
      </ha-card>
    `;
  }

  /** The unit the *displayed* current temperature is in (override sensor wins). */
  private temperatureUnit(weather: HassEntity, config: ResolvedConfig | undefined = this._config): string {
    const override = this.overrideEntity(config?.temperature_entity);
    return (
      ((override ? override.attributes.unit_of_measurement : weather.attributes.temperature_unit) as string | undefined) ??
      this.hass!.config.unit_system.temperature
    );
  }

  private overrideEntity(id: string | undefined): HassEntity | undefined {
    return id ? this.hass!.states[id] : undefined;
  }

  private currentTemperature(weather: HassEntity, config: ResolvedConfig | undefined = this._config): number | undefined {
    const override = this.overrideEntity(config?.temperature_entity);
    const raw = override ? override.state : weather.attributes.temperature;
    const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  /** Forecast views the entity supports, plus the camera tab (layout `tab`). */
  private tabs(weather: HassEntity): Tab[] {
    const config = this._config!;
    const camera = hasCamera(config) && config.camera_layout === "tab";
    return [...this.availableViews(weather), ...(camera ? (["camera"] as const) : [])];
  }

  /** The tab this update shows: the chosen one when available, else the first; none while the entity is unavailable. */
  private visibleTab(): Tab | undefined {
    const weather = this._config && this.hass?.states[this._config.entity];
    if (!weather || weather.state === "unavailable" || weather.state === "unknown") return undefined;
    const tabs = this.tabs(weather);
    return tabs.includes(this._view) ? this._view : tabs[0];
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
    // An explicit card `language` wins over the HA profile language, so use our own condition names.
    if (this._config?.language) {
      const key = `conditions.${weather.state}`;
      const own = this.localize(key);
      if (own !== key) return own;
    }
    return (
      hass.formatEntityState?.(weather) ||
      hass.localize?.(`component.weather.entity_component._.state.${weather.state}`) ||
      weather.state
    );
  }

  private renderHeader(
    weather: HassEntity,
    temperature: number | undefined,
    now: Date,
    dark: boolean,
  ): TemplateResult {
    const config = this._config!;
    const fmt = this.formatters;
    const unit = this.temperatureUnit(weather);
    const name = this.locationName(config, weather);
    const picker = this.locations.length > 1;
    const interactive = isInteractive(this.temperatureAction());
    const cardInteractive = isInteractive(this.cardAction());
    const today = dailySlots(this.daily.forecast, now, 1, fmt, "")[0];
    const range =
      today?.isCurrent && defined(today.temperature) && defined(today.templow)
        ? `${this.localize("common.max")} ${fmt.number(today.temperature)}° · ${this.localize("common.min")} ${fmt.number(today.templow)}°`
        : undefined;

    // Temperature on the left, name / condition / range right-aligned (design "C4 v2a").
    return html`
      <div class="header">
        ${temperature === undefined
          ? nothing
          : html`<div
              class="temperature ${interactive ? "interactive" : ""}"
              role=${interactive ? "button" : nothing}
              tabindex=${interactive ? 0 : nothing}
              @click=${this.onTemperatureTap}
              @keydown=${this.onTemperatureTap}
            >
              ${fmt.number(temperature, 1)}<span class="unit">${unit}</span>
            </div>`}
        <div class="info">
          ${config.show_name
            ? this.festivity
              ? picker
                ? html`<span class="brand picker-brand">${renderFestivityBrand(this.festivity, dark)}${this.renderPicker(name)}</span>`
                : html`<span class="secondary brand">${renderFestivityBrand(this.festivity, dark)}<span class="name">${name}</span></span>`
              : picker
                ? this.renderPicker(name)
                : html`<span class="secondary">${name}</span>`
            : nothing}
          <div
            class="summary ${cardInteractive ? "interactive" : ""}"
            role=${cardInteractive ? "button" : nothing}
            tabindex=${cardInteractive ? 0 : nothing}
            @click=${this.onCardTap}
            @keydown=${this.onCardTap}
          >
            <div class="condition">${weatherIcon(weather.state, 24)}<span class="state">${this.conditionLabel(weather)}</span></div>
            ${range ? html`<span class="range">${range}</span>` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private locationName(config: ResolvedConfig, weather: HassEntity | undefined): string {
    return config.name ?? (weather?.attributes.friendly_name as string | undefined) ?? config.entity;
  }

  /** Name line as a selector (several places). The list is only rendered, and its entities only read, while open. */
  private renderPicker(name: string): TemplateResult {
    const label = this.localize("location.label");
    // Clicks stay inside: the card's own tap action must not fire.
    return html`<div class="picker" @click=${this.stop} @keydown=${this.stop}>
      <button
        type="button"
        class="picker-button"
        aria-haspopup="listbox"
        aria-expanded=${this._pickerOpen}
        aria-label=${this.localize("location.change")}
        @click=${this.togglePicker}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        <span class="picker-name">${name}</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${this._pickerOpen || this._pickerLeaving
        ? html`<div class="picker-list ${this._pickerOpen ? "" : "leaving"}" role="listbox" aria-label=${label}>
            <div class="picker-title">${label}</div>
            ${this.locations.map((location, index) => this.renderPickerOption(location, index))}
          </div>`
        : nothing}
    </div>`;
  }

  private renderPickerOption(location: ResolvedConfig, index: number): TemplateResult {
    const state = this.hass!.states[location.entity];
    const weather = state && state.state !== "unavailable" && state.state !== "unknown" ? state : undefined;
    const temperature = weather ? this.currentTemperature(weather, location) : undefined;
    const selected = index === this._index;
    return html`<button
      type="button"
      role="option"
      class="picker-option"
      aria-selected=${selected}
      data-index=${index}
      @click=${this.onPickerOption}
    >
      ${weather ? weatherIcon(weather.state, 22) : nothing}
      <span class="picker-text">
        <span class="picker-place">${this.locationName(location, state)}</span>
        <span class="picker-condition">${weather ? this.conditionLabel(weather) : this.localize("common.unavailable")}</span>
      </span>
      ${temperature === undefined ? nothing : html`<span class="picker-temperature">${this.formatters.number(temperature)}°</span>`}
      <svg class="check" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  }

  private renderAlertBanner(now: Date): TemplateResult | typeof nothing {
    const config = this._config!;
    if (!this.activeAlerts.length) return nothing;
    const labels = { today: this.localize("common.today"), until: this.localize("alerts.until") };
    const windows = new Map(
      this.activeAlerts.map((alert) => [alert.id, formatWindow(alert, now, this.formatters, labels)]),
    );
    // Alerts only change when their entities do, so the click guard lives on the wrapper (not the card action).
    return html`<div @click=${this.stop} @keydown=${this.stop}>
      ${renderAlerts({
        alerts: this.activeAlerts,
        maxVisible: config.alerts?.max_visible ?? ALERT_DEFAULTS.max_visible,
        expanded: this._alertsOpen,
        onToggle: this.toggleAlerts,
        windows,
        localize: this.localize,
      })}
    </div>`;
  }

  private renderCameraStrip(): TemplateResult {
    // Clicks stay inside the strip: the card's own tap action must not fire.
    return html`<div @click=${this.stop} @keydown=${this.stop}>
      ${renderCameraStrip({ ...this.cameraView(), open: this._cameraOpen, onToggle: this.toggleCamera, onOpen: this.cameraOpener() })}
    </div>`;
  }

  private renderCameraTab(): TemplateResult {
    return html`<div class="forecast camera-tab" @click=${this.stop} @keydown=${this.stop}>
      ${renderCameraPanel({ ...this.cameraView(), onOpen: this.cameraOpener() })}
    </div>`;
  }

  private renderTabs(tabs: Tab[], view: Tab | undefined): TemplateResult | typeof nothing {
    if (tabs.length < 2 || !view) return nothing;
    return html`<div
      class="tabs"
      role="group"
      aria-label=${this.localize("tabs.label")}
      style="--tabs: ${tabs.length}; --tab: ${tabs.indexOf(view)}"
      @click=${this.stop}
      @keydown=${this.stop}
    >
      ${tabs.map(
        (tab) => html`<button type="button" aria-pressed=${tab === view} data-tab=${tab} @click=${this.onTab}>
          ${this.localize(`tabs.${tab}`)}
        </button>`,
      )}
    </div>`;
  }

  private renderForecast(
    weather: HassEntity,
    view: View,
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

    const past =
      this.history.data && (view === "hourly" ? config.history_hours : config.history_days) > 0
        ? this.pastSlots(view, weather, forecastUnit, now)
        : [];
    const states = this.hass!.states;
    const sun =
      view === "hourly"
        ? readSunSources(
            {
              sun: config.sun_entity ? states[config.sun_entity] : undefined,
              rising: config.sunrise_entity ? states[config.sunrise_entity] : undefined,
              setting: config.sunset_entity ? states[config.sunset_entity] : undefined,
            },
            now.getTime(),
          )
        : undefined;
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
            past,
          )
        : dailySlots(data, now, config.days_to_show, this.formatters, this.localize("common.today"), past);
    const shown = withDaylight(slots, sun);

    const width = this._width;
    const pastColumns = pastCount(shown);
    const scrollable = isScrollable(view, width, shown.length, pastColumns);

    return html`
      <div class="forecast" @click=${this.stop} @keydown=${this.stop}>
        ${data === undefined
          ? nothing
          : html`<div
              class="scroller ${scrollable ? "scrollable" : ""}"
              tabindex=${scrollable ? 0 : nothing}
              role=${scrollable ? "region" : nothing}
              data-past=${pastColumns || nothing}
              aria-label=${scrollable ? this.localize(view === "hourly" ? "chart.scroll" : "chart.days") : nothing}
              @scroll=${this.onScroll}
              @pointerdown=${this.onPointerDown}
              @pointermove=${this.onPointerMove}
              @pointerup=${this.onPointerEnd}
              @pointercancel=${this.onPointerEnd}
            >
              ${renderChart({
                kind: view,
                slots: shown,
                sun,
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

  /** Recorded hours before "Now": the temperature sensor when configured, else the weather entity itself. */
  private pastSlots(view: View, weather: HassEntity, forecastUnit: string, now: Date) {
    const config = this._config!;
    const data = this.history.data!;
    const sensor = config.temperature_entity;
    const weatherStates = data[config.entity];
    const useSensor = !!sensor && !!data[sensor]?.length;
    const points = useSensor ? toPoints(data[sensor], "state") : toPoints(weatherStates, "attribute");
    const from = useSensor ? this.temperatureUnit(weather) : forecastUnit;
    const converted = points.map((p) => ({ ...p, value: convertTemperature(p.value, from, forecastUnit) }));
    return view === "hourly"
      ? pastHourlySlots(converted, weatherStates, now, config.history_hours, this.formatters)
      : pastDailySlots(converted, weatherStates, now, config.history_days, this.formatters);
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
    const push = (
      metric: "humidity" | "wind" | "uv",
      value: number,
      text: string,
      entity: string | undefined,
      scaled = value,
    ) => {
      const level = getLevel(metric, scaled);
      out.push({
        metric,
        value: text,
        level,
        levelLabel: this.localize(`levels.${metric}.${LEVEL_KEYS[metric][level]}`),
        name: this.localize(`attributes.${metric}`),
        entity: entity && this.overrideEntity(entity) ? entity : undefined,
      });
    };

    const humidity = read(config.humidity_entity, attrs.humidity);
    if (Number.isFinite(humidity.value)) push("humidity", humidity.value, `${fmt.number(humidity.value)} %`, config.humidity_entity);

    const wind = read(config.wind_speed_entity, attrs.wind_speed);
    if (Number.isFinite(wind.value)) {
      const unit =
        wind.unit ?? (attrs.wind_speed_unit as string | undefined) ?? hass.config.unit_system.wind_speed ?? "km/h";
      const bearing = cardinal(attrs.wind_bearing as number | string | undefined);
      const direction = bearing ? (hass.localize?.(`ui.card.weather.cardinal_direction.${bearing.toLowerCase()}`) || bearing) : "";
      push("wind", wind.value, `${fmt.number(wind.value, 1)} ${unit}${direction ? ` ${direction}` : ""}`, config.wind_speed_entity, toKmh(wind.value, unit));
    }

    const uv = read(config.uv_index_entity, attrs.uv_index);
    if (Number.isFinite(uv.value)) push("uv", uv.value, fmt.number(uv.value, 1), config.uv_index_entity);
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
