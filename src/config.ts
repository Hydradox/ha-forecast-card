import type { ActionConfig } from "./types/ha";
import { isActionConfig } from "./utils/actions";
import type { AlertsConfig } from "./utils/alerts";
import type { FestivityRules } from "./festivities/calendar";
import { festivityRulesValid, isFestivity } from "./festivities/calendar";
import { parseAlertsConfig } from "./utils/alerts";
import type { CameraLayout } from "./utils/camera";
import { CAMERA_LAYOUTS } from "./utils/camera";

export type ForecastView = "hourly" | "daily";

/** Everything that can differ per place: one entry of `locations`, or the card's own top level when there is only one. */
export interface LocationConfig {
  /** `weather.*` entity providing conditions and forecasts. */
  entity: string;
  /** Optional card title override (defaults to the entity friendly name). */
  name?: string;
  /** Show the name line (default true). */
  show_name?: boolean;
  /** Tab shown first. `camera` needs `camera_entity` with the `tab` layout, else the first forecast tab is used. */
  default_view?: ForecastView | "camera";
  /** Number of hourly / daily slots to render. */
  hours_to_show?: number;
  days_to_show?: number;
  /**
   * Past hours reachable by scrolling back in the hourly view (0 disables). Values come from the recorder
   * history of `temperature_entity`, or of the weather entity when there is none.
   */
  history_hours?: number;
  /** Same for the daily view: past days (daily high and low) reachable by scrolling back (0 disables). */
  history_days?: number;
  /** Optional overrides for attribute sources (sensor entities, realtime). */
  temperature_entity?: string;
  humidity_entity?: string;
  wind_speed_entity?: string;
  uv_index_entity?: string;
  /**
   * Temperature colour thresholds, in the Home Assistant display unit. Omitted → defaults
   * (declared once in °C, see `utils/temperature.ts`) converted to that unit.
   */
  cold_threshold?: number;
  hot_threshold?: number;
  /** Tap on the card. Default: more-info of the weather entity. */
  tap_action?: ActionConfig;
  /** Tap on the temperature. Default: more-info of `temperature_entity` (history graph) or the weather entity. */
  temperature_tap_action?: ActionConfig;
  /** Weather alerts from provider entities (Meteoalarm, NWS, Environment Canada or a custom sensor). */
  alerts?: AlertsConfig;
  /**
   * Camera shown in the card (`camera.*`). Nothing camera-related is drawn unless it is set. Plays the live stream when
   * the entity supports it, otherwise a still reloaded every `camera_refresh`. For a webcam URL, add it with the
   * Generic Camera integration.
   */
  camera_entity?: string;
  /** Label over the image (defaults to the entity name). */
  camera_name?: string;
  /** `tab`: a third tab next to Hourly/Daily. `strip`: an expandable band under the header. */
  camera_layout?: CameraLayout;
  /** Tap on the camera image. Default: more-info (live view) of the camera entity. */
  camera_tap_action?: ActionConfig;
  /** Seconds between image reloads while the camera is visible. */
  camera_refresh?: number;
  /**
   * Seasonal decoration: `auto` follows the calendar, `none` disables it, a festivity name forces it, and an
   * entity id (such as an `input_select`) takes one of those values from its state.
   */
  festivity?: string;
  /** Animated weather effect behind the header (default true). */
  weather_effects?: boolean;
  /** Per-festivity rules for `festivity: auto`: turn one off, or correct its dates. */
  festivities?: FestivityRules;
}

export interface ForecastCardConfig extends Partial<LocationConfig> {
  type: string;
  /** Language override; defaults to the Home Assistant UI language. */
  language?: string;
  /**
   * Several places, each with the same options as a single card. With two or more, the name line becomes a
   * selector (so `show_name` is forced on) and only the selected place loads forecasts, history and camera.
   * Replaces the top-level `entity` and per-location options.
   */
  locations?: LocationConfig[];
}

export const DEFAULT_CONFIG = {
  show_name: true,
  default_view: "hourly",
  hours_to_show: 10,
  days_to_show: 7,
  history_hours: 12,
  history_days: 3,
  festivity: "auto",
  weather_effects: true,
  camera_layout: "tab",
  camera_refresh: 300,
} as const satisfies Partial<LocationConfig>;

/** One place with defaults applied (`language` is shared by the whole card). */
export type ResolvedConfig = LocationConfig &
  Required<Pick<LocationConfig, keyof typeof DEFAULT_CONFIG>> & { type?: string; language?: string };

const ENTITY_FIELDS = [
  "entity",
  "temperature_entity",
  "humidity_entity",
  "wind_speed_entity",
  "uv_index_entity",
] as const;

/** Validates one place (the whole card config when `locations` is absent). Throws on invalid input. */
export function parseConfig(raw: unknown): ResolvedConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid configuration");
  }
  const config = raw as Partial<LocationConfig> & { language?: string };

  if (typeof config.entity !== "string" || !config.entity.startsWith("weather.")) {
    throw new Error("`entity` must be a weather.* entity");
  }
  for (const field of ENTITY_FIELDS) {
    const value = config[field];
    if (value !== undefined && typeof value !== "string") {
      throw new Error(`\`${field}\` must be an entity id`);
    }
  }
  if (config.default_view !== undefined && !["hourly", "daily", "camera"].includes(config.default_view)) {
    throw new Error("`default_view` must be 'hourly', 'daily' or 'camera'");
  }
  for (const field of ["hours_to_show", "days_to_show"] as const) {
    const value = config[field];
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
      throw new Error(`\`${field}\` must be a positive integer`);
    }
  }
  for (const field of ["history_hours", "history_days"] as const) {
    const value = config[field];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`\`${field}\` must be an integer ≥ 0`);
    }
  }

  if (config.show_name !== undefined && typeof config.show_name !== "boolean") {
    throw new Error("`show_name` must be true or false");
  }
  for (const field of ["cold_threshold", "hot_threshold"] as const) {
    const value = config[field];
    if (value !== undefined && !Number.isFinite(value)) {
      throw new Error(`\`${field}\` must be a number`);
    }
  }
  if (config.cold_threshold !== undefined && config.hot_threshold !== undefined && config.hot_threshold <= config.cold_threshold) {
    throw new Error("`hot_threshold` must be greater than `cold_threshold`");
  }
  for (const field of ["tap_action", "temperature_tap_action", "camera_tap_action"] as const) {
    const value = config[field];
    if (value !== undefined && !isActionConfig(value)) {
      throw new Error(`\`${field}\` must be a valid action`);
    }
  }

  if (config.festivity !== undefined) {
    const value = config.festivity;
    if (typeof value !== "string" || !(["auto", "none"].includes(value) || isFestivity(value) || value.includes("."))) {
      throw new Error("`festivity` must be 'auto', 'none', a festivity name or an entity id");
    }
  }

  if (config.weather_effects !== undefined && typeof config.weather_effects !== "boolean") {
    throw new Error("`weather_effects` must be true or false");
  }
  if (!festivityRulesValid(config.festivities)) {
    throw new Error("`festivities` must map festivity names to { enabled, start, end } (MM-DD) or, for easter and carnival, { enabled, start_offset, end_offset }");
  }

  if (config.camera_entity !== undefined && (typeof config.camera_entity !== "string" || !config.camera_entity.startsWith("camera."))) {
    throw new Error("`camera_entity` must be a camera.* entity");
  }
  if (config.camera_name !== undefined && typeof config.camera_name !== "string") {
    throw new Error("`camera_name` must be text");
  }
  if (config.camera_layout !== undefined && !CAMERA_LAYOUTS.includes(config.camera_layout)) {
    throw new Error("`camera_layout` must be 'tab' or 'strip'");
  }
  if (config.camera_refresh !== undefined && !(Number.isFinite(config.camera_refresh) && config.camera_refresh >= 1)) {
    throw new Error("`camera_refresh` must be a number of seconds ≥ 1");
  }

  if (config.alerts !== undefined) parseAlertsConfig(config.alerts);

  return { ...DEFAULT_CONFIG, ...config } as ResolvedConfig;
}

/**
 * Validates the card config: the places it shows, in order. `locations` wins over the top-level `entity`;
 * with two or more, the name line hosts the selector, so `show_name` is forced on.
 */
export function parseLocations(raw: unknown): ResolvedConfig[] {
  if (!raw || typeof raw !== "object") throw new Error("Invalid configuration");
  const { locations, language } = raw as Partial<ForecastCardConfig>;
  if (locations === undefined) return [parseConfig(raw)];
  if (!Array.isArray(locations) || !locations.length) throw new Error("`locations` must be a non-empty list");
  return locations.map((location, index) => {
    try {
      const parsed = parseConfig({ ...(location as object), language });
      return locations.length > 1 ? { ...parsed, show_name: true } : parsed;
    } catch (error) {
      throw new Error(`locations[${index}]: ${(error as Error).message}`);
    }
  });
}

/**
 * Drops keys that are empty or equal to their default, so saved YAML only holds real choices
 * (and unit-dependent defaults keep following the HA unit system).
 */
export function compactConfig(
  config: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(
      ([key, value]) => value !== undefined && value !== "" && value !== null && value !== defaults[key],
    ),
  );
}

/** Both thresholds (display unit) must be ordered; used by the editor, mirrors `parseConfig`. */
export function thresholdsInOrder(cold: unknown, hot: unknown): boolean {
  return !(typeof cold === "number" && typeof hot === "number" && hot <= cold);
}
