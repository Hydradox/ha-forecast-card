export type ForecastView = "hourly" | "daily";

export interface ForecastCardConfig {
  type: string;
  /** `weather.*` entity providing conditions and forecasts. */
  entity: string;
  /** Optional card title override (defaults to the entity friendly name). */
  name?: string;
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
  /** Language override; defaults to the Home Assistant UI language. */
  language?: string;
}

export const DEFAULT_CONFIG = {
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

  return { ...DEFAULT_CONFIG, ...config } as ResolvedConfig;
}
