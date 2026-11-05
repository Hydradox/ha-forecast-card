import type { ActionConfig } from "./types/ha";
import { isActionConfig } from "./utils/actions";

export type ForecastView = "hourly" | "daily";

export interface ForecastCardConfig {
  type: string;
  /** `weather.*` entity providing conditions and forecasts. */
  entity: string;
  /** Optional card title override (defaults to the entity friendly name). */
  name?: string;
  /** Show the name line (default true). */
  show_name?: boolean;
  /** Tab shown first. */
  default_view?: ForecastView;
  /** Number of hourly / daily slots to render. */
  hours_to_show?: number;
  days_to_show?: number;
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
  /** Language override; defaults to the Home Assistant UI language. */
  language?: string;
}

export const DEFAULT_CONFIG = {
  show_name: true,
  default_view: "hourly",
  hours_to_show: 10,
  days_to_show: 7,
} as const satisfies Partial<ForecastCardConfig>;

export type ResolvedConfig = ForecastCardConfig &
  Required<Pick<ForecastCardConfig, keyof typeof DEFAULT_CONFIG>>;

const ENTITY_FIELDS = [
  "entity",
  "temperature_entity",
  "humidity_entity",
  "wind_speed_entity",
  "uv_index_entity",
] as const;

/** Validates user config. Throws on invalid input. Never touches `hass`. */
export function parseConfig(raw: unknown): ResolvedConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid configuration");
  }
  const config = raw as Partial<ForecastCardConfig>;

  if (typeof config.entity !== "string" || !config.entity.startsWith("weather.")) {
    throw new Error("`entity` must be a weather.* entity");
  }
  for (const field of ENTITY_FIELDS) {
    const value = config[field];
    if (value !== undefined && typeof value !== "string") {
      throw new Error(`\`${field}\` must be an entity id`);
    }
  }
  if (config.default_view !== undefined && !["hourly", "daily"].includes(config.default_view)) {
    throw new Error("`default_view` must be 'hourly' or 'daily'");
  }
  for (const field of ["hours_to_show", "days_to_show"] as const) {
    const value = config[field];
    if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
      throw new Error(`\`${field}\` must be a positive integer`);
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
  for (const field of ["tap_action", "temperature_tap_action"] as const) {
    const value = config[field];
    if (value !== undefined && !isActionConfig(value)) {
      throw new Error(`\`${field}\` must be a valid action`);
    }
  }

  return { ...DEFAULT_CONFIG, ...config } as ResolvedConfig;
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
