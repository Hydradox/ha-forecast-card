import type { HassEntity } from "../types/ha";
import type { Formatters } from "./format";

/**
 * Weather alerts. Home Assistant has no standard alert API, so each provider exposes alerts in its own
 * entities. An *adapter* turns those entities into one normalized `WeatherAlert`; everything else (sorting,
 * rendering) only deals with that shape. Pure logic, no DOM.
 */

/** 1 yellow, 2 orange, 3 red, 4 extreme. */
export type AlertLevel = 1 | 2 | 3 | 4;
export type AlertAdapter = "auto" | "meteoalarm" | "nws" | "environment_canada" | "custom";
export type AlertKind = "wind" | "rain" | "temperature" | "general";

export interface AlertSourceConfig {
  entity: string;
  /** Provider adapter. Default `auto` (detected from the entity). */
  adapter?: AlertAdapter;
  /** Attribute names, used by the `custom` adapter (and as overrides for the others). */
  level_attr?: string;
  event_attr?: string;
  headline_attr?: string;
  description_attr?: string;
  starts_attr?: string;
  expires_attr?: string;
  /** Maps the raw value of `level_attr` to a level (0 hides the alert). */
  levels?: Record<string, number>;
}

export interface AlertsConfig {
  entities: (string | AlertSourceConfig)[];
  /** Hide alerts below this level (default 1). */
  min_level?: AlertLevel;
  /** Alerts shown before the user expands the list (default 1). */
  max_visible?: number;
}

export const ALERT_DEFAULTS = { min_level: 1, max_visible: 1 } as const;

export interface WeatherAlert {
  id: string;
  level: AlertLevel;
  kind: AlertKind;
  /** Event name when the provider gives one, else the headline. */
  title: string;
  description?: string;
  starts?: Date;
  expires?: Date;
  source: string;
}

const ADAPTERS: readonly AlertAdapter[] = ["auto", "meteoalarm", "nws", "environment_canada", "custom"];
const ATTR_FIELDS = [
  "level_attr",
  "event_attr",
  "headline_attr",
  "description_attr",
  "starts_attr",
  "expires_attr",
] as const;

// ── Config ───────────────────────────────────────────────────────────────────

/** Validates the `alerts` block. Throws on invalid input. */
export function parseAlertsConfig(raw: unknown): AlertsConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("`alerts` must be an object");
  const config = raw as Partial<AlertsConfig>;
  if (!Array.isArray(config.entities)) throw new Error("`alerts.entities` must be a list");
  for (const item of config.entities) {
    const source = typeof item === "string" ? { entity: item } : (item as Partial<AlertSourceConfig> | null);
    if (!source || typeof source !== "object" || typeof source.entity !== "string" || !source.entity.includes(".")) {
      throw new Error("`alerts.entities` items must be entity ids or objects with an `entity`");
    }
    if (source.adapter !== undefined && !ADAPTERS.includes(source.adapter)) {
      throw new Error(`\`adapter\` must be one of ${ADAPTERS.join(", ")}`);
    }
    for (const field of ATTR_FIELDS) {
      if (source[field] !== undefined && typeof source[field] !== "string") {
        throw new Error(`\`${field}\` must be an attribute name`);
      }
    }
    if (source.levels !== undefined) {
      const valid =
        typeof source.levels === "object" &&
        source.levels !== null &&
        Object.values(source.levels).every((level) => Number.isInteger(level) && level >= 0 && level <= 4);
      if (!valid) throw new Error("`levels` must map values to integers from 0 to 4");
    }
  }
  if (config.min_level !== undefined && ![1, 2, 3, 4].includes(config.min_level)) {
    throw new Error("`alerts.min_level` must be 1, 2, 3 or 4");
  }
  if (config.max_visible !== undefined && (!Number.isInteger(config.max_visible) || config.max_visible < 1)) {
    throw new Error("`alerts.max_visible` must be a positive integer");
  }
  return config as AlertsConfig;
}

export function alertSources(config: AlertsConfig | undefined): AlertSourceConfig[] {
  return (config?.entities ?? []).map((item) => (typeof item === "string" ? { entity: item } : item));
}

// ── Reading entities ─────────────────────────────────────────────────────────

const INACTIVE_STATES = new Set(["", "off", "0", "none", "false", "no", "unavailable", "unknown"]);

const norm = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

type Record_ = Record<string, unknown>;
type Pick_ = (names: readonly string[]) => unknown;

/** Case- and punctuation-insensitive attribute lookup (`Expires`, `expires`, `expire_time`...). */
function picker(record: Record_): Pick_ {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) map.set(norm(key), value);
  return (names) => {
    for (const name of names) {
      const value = map.get(norm(name));
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
  };
}

const text = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
};

const date = (value: unknown): Date | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const SEVERITY_NWS: Record<string, number> = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
/** MeteoAlarm awareness levels are colours; CAP severity is one step above them. */
const SEVERITY_METEOALARM: Record<string, number> = { minor: 0, moderate: 1, severe: 2, extreme: 3 };
const COLOR_METEOALARM: Record<string, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

const lowerText = (value: unknown): string => (text(value) ?? "").toLowerCase();
const clamp = (level: number): AlertLevel | 0 => (level >= 1 ? (Math.min(4, Math.round(level)) as AlertLevel) : 0);

export function resolveAdapter(entity: HassEntity, source: AlertSourceConfig): Exclude<AlertAdapter, "auto"> {
  if (source.adapter && source.adapter !== "auto") return source.adapter;
  const hint = `${entity.entity_id} ${text(entity.attributes.attribution) ?? ""}`.toLowerCase();
  if (hint.includes("meteoalarm")) return "meteoalarm";
  if (/_(warnings?|watch(es)?|statements?|advisories|endings?)$/.test(entity.entity_id)) return "environment_canada";
  if (hint.includes("environment canada")) return "environment_canada";
  return "nws"; // plain CAP severity (Minor..Extreme) is the common denominator
}

const ADAPTER_NAMES: Record<string, string> = {
  meteoalarm: "Meteoalarm",
  nws: "NWS",
  environment_canada: "Environment Canada",
};

function levelOf(
  adapter: Exclude<AlertAdapter, "auto">,
  entity: HassEntity,
  source: AlertSourceConfig,
  pick: Pick_,
): AlertLevel | 0 {
  const custom = source.level_attr ? pick([source.level_attr]) : undefined;
  if (adapter === "custom" || custom !== undefined) {
    const raw = text(custom);
    if (raw === undefined) return 0;
    const mapped = Object.entries(source.levels ?? {}).find(([key]) => key.toLowerCase() === raw.toLowerCase());
    if (mapped) return clamp(mapped[1]);
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? clamp(numeric) : clamp(SEVERITY_NWS[raw.toLowerCase()] ?? 0);
  }
  if (adapter === "meteoalarm") {
    const color = /(green|yellow|orange|red)/.exec(lowerText(pick(["awareness_level"])))?.[1];
    if (color) return clamp(COLOR_METEOALARM[color]);
    return clamp(SEVERITY_METEOALARM[lowerText(pick(["severity"]))] ?? 0);
  }
  if (adapter === "environment_canada") {
    const hint = `${entity.entity_id} ${lowerText(pick(["type", "alert_type"]))}`;
    if (/warning/.test(hint)) return 3;
    if (/watch/.test(hint)) return 2;
    if (/(advisor|statement)/.test(hint)) return 1;
    return 0; // endings and anything unknown
  }
  return clamp(SEVERITY_NWS[lowerText(pick(["severity"]))] ?? 0);
}

const KINDS: [AlertKind, RegExp][] = [
  ["wind", /\b(wind|gust|viento|rachas|vent)/i],
  ["rain", /(rain|shower|flood|storm|thunder|lluvia|precip|tormenta|inunda|pluie|orage)/i],
  ["temperature", /(heat|cold|frost|freez|temperat|calor|fr[ií]o|helada|canicula|gel)/i],
];

export function alertKind(title: string): AlertKind {
  return KINDS.find(([, pattern]) => pattern.test(title))?.[0] ?? "general";
}

/**
 * Alerts of one entity. A provider either exposes one alert in the attributes of the entity
 * or a list of them in an `alerts` attribute; both end up as the same shape.
 */
export function readAlerts(entity: HassEntity, source: AlertSourceConfig): WeatherAlert[] {
  const list = entity.attributes.alerts;
  const records: Record_[] = Array.isArray(list)
    ? list.filter((item): item is Record_ => !!item && typeof item === "object")
    : INACTIVE_STATES.has(entity.state.toLowerCase())
      ? []
      : [entity.attributes];

  const adapter = resolveAdapter(entity, source);
  const sourceName =
    ADAPTER_NAMES[adapter] ?? text(entity.attributes.attribution) ?? text(entity.attributes.friendly_name) ?? entity.entity_id;

  const alerts: WeatherAlert[] = [];
  records.forEach((record, index) => {
    // Per-alert records inherit entity attributes they lack (e.g. `attribution`).
    const pick = picker(Array.isArray(list) ? { ...entity.attributes, ...record } : record);
    const level = levelOf(adapter, entity, source, pick);
    if (!level) return;
    const named = (override: string | undefined, names: readonly string[]) =>
      text(override ? pick([override]) : undefined) ?? text(pick(names));
    const event = named(source.event_attr, ["event", "title", "alert_type"]);
    const headline = named(source.headline_attr, ["headline"]);
    const title = event ?? headline;
    if (!title) return;
    const description = named(source.description_attr, ["description", "text", "detail"]) ?? (event ? headline : undefined);
    alerts.push({
      id: `${entity.entity_id}#${index}`,
      level,
      kind: alertKind(title),
      title,
      description: description && description !== title ? description : undefined,
      starts: date(source.starts_attr ? pick([source.starts_attr]) : pick(["starts", "onset", "effective", "start"])),
      expires: date(source.expires_attr ? pick([source.expires_attr]) : pick(["expires", "ends", "end"])),
      source: sourceName,
    });
  });
  return alerts;
}

/** Active alerts across all sources: expired and below `min_level` dropped, most severe first. */
export function collectAlerts(
  states: Record<string, HassEntity | undefined>,
  config: AlertsConfig | undefined,
  now: Date,
): WeatherAlert[] {
  const minLevel = config?.min_level ?? ALERT_DEFAULTS.min_level;
  const seen = new Set<string>();
  const alerts: WeatherAlert[] = [];
  for (const source of alertSources(config)) {
    const entity = states[source.entity];
    if (!entity) continue;
    for (const alert of readAlerts(entity, source)) {
      const key = `${alert.title}|${alert.starts?.getTime() ?? ""}|${alert.expires?.getTime() ?? ""}|${alert.level}`;
      if (alert.level < minLevel || (alert.expires && alert.expires <= now) || seen.has(key)) continue;
      seen.add(key);
      alerts.push(alert);
    }
  }
  return alerts.sort(
    (a, b) => b.level - a.level || (a.starts?.getTime() ?? 0) - (b.starts?.getTime() ?? 0),
  );
}

/** `Today 18:00 – 23:59`, `Sat 06:00 – Sun 09:00`, `Until Today 23:59`. Empty when the provider gives no times. */
export function formatWindow(
  alert: Pick<WeatherAlert, "starts" | "expires">,
  now: Date,
  fmt: Formatters,
  labels: { today: string; until: string },
): string {
  const day = (d: Date) => (fmt.dayKey(d) === fmt.dayKey(now) ? labels.today : fmt.weekday(d));
  const { starts, expires } = alert;
  if (starts && expires) {
    const same = fmt.dayKey(starts) === fmt.dayKey(expires);
    return `${day(starts)} ${fmt.hour(starts)} – ${same ? "" : `${day(expires)} `}${fmt.hour(expires)}`;
  }
  if (expires) return `${labels.until} ${day(expires)} ${fmt.hour(expires)}`;
  if (starts) return `${day(starts)} ${fmt.hour(starts)}`;
  return "";
}

/** Drops default values so saved YAML only holds real choices. Returns undefined when nothing is left. */
export function compactAlerts(config: AlertsConfig | undefined): AlertsConfig | undefined {
  if (!config?.entities?.length) return undefined;
  const { min_level, max_visible, entities } = config;
  return {
    entities,
    ...(min_level !== undefined && min_level !== ALERT_DEFAULTS.min_level ? { min_level } : {}),
    ...(max_visible !== undefined && max_visible !== ALERT_DEFAULTS.max_visible ? { max_visible } : {}),
  };
}
