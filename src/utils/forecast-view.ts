/** Pure data preparation for the forecast chart: slot selection and geometry. No DOM, fully testable. */
import type { ForecastEntry } from "../types/weather";
import type { Formatters } from "./format";

export interface Slot {
  key: string;
  label: string;
  isCurrent: boolean;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  probability?: number;
  isDaytime?: boolean;
}

export interface CurrentConditions {
  condition?: string;
  temperature?: number;
}

const HOUR_MS = 3_600_000;

/** "Now" slot followed by the upcoming hours (the entry covering the current hour is replaced by "Now"). */
export function hourlySlots(
  entries: readonly ForecastEntry[] | undefined,
  now: Date,
  count: number,
  fmt: Formatters,
  current: CurrentConditions,
  nowLabel: string,
): Slot[] {
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const upcoming = (entries ?? [])
    .filter((entry) => new Date(entry.datetime).getTime() > currentHour)
    .slice(0, Math.max(count - 1, 0))
    .map<Slot>((entry) => toSlot(entry, fmt.hour(new Date(entry.datetime)), false));
  return [{ key: "now", label: nowLabel, isCurrent: true, ...current }, ...upcoming].slice(0, count);
}

/** Today (labelled) and the following days. */
export function dailySlots(
  entries: readonly ForecastEntry[] | undefined,
  now: Date,
  count: number,
  fmt: Formatters,
  todayLabel: string,
): Slot[] {
  const today = fmt.dayKey(now);
  return (entries ?? [])
    .filter((entry) => fmt.dayKey(new Date(entry.datetime)) >= today)
    .slice(0, count)
    .map((entry) => {
      const date = new Date(entry.datetime);
      const isToday = fmt.dayKey(date) === today;
      return toSlot(entry, isToday ? todayLabel : fmt.weekday(date), isToday);
    });
}

function toSlot(entry: ForecastEntry, label: string, isCurrent: boolean): Slot {
  return {
    key: entry.datetime,
    label,
    isCurrent,
    condition: entry.condition,
    temperature: entry.temperature,
    templow: entry.templow,
    precipitation: entry.precipitation,
    probability: entry.precipitation_probability,
    isDaytime: entry.is_daytime,
  };
}

export const defined = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value);

/** Linear map value → y. A flat domain maps to the middle of the range. */
export function createScale(min: number, max: number, top: number, bottom: number): (value: number) => number {
  if (max - min < 1e-9) return () => (top + bottom) / 2;
  return (value) => top + ((max - value) / (max - min)) * (bottom - top);
}

export function extent(values: readonly number[]): [number, number] | undefined {
  if (!values.length) return undefined;
  return [Math.min(...values), Math.max(...values)];
}

/** Rain bars are relative to the largest value, but never below `floor`, so drizzle stays small. */
export function barHeight(value: number, largest: number, floor: number, maxHeight: number): number {
  return (value / Math.max(largest, floor)) * maxHeight;
}

/** Smallest "full height" amount of precipitation in the unit used (2 mm ≈ 0.08 in). */
export const RAIN_FLOOR = { mm: 2, in: 0.08 } as const;

export type RainMode = "amount" | "probability" | "none";

/** Prefer amounts; fall back to probability when the integration only provides that. */
export function rainMode(slots: readonly Slot[]): RainMode {
  if (slots.some((slot) => defined(slot.precipitation))) return "amount";
  if (slots.some((slot) => defined(slot.probability))) return "probability";
  return "none";
}

export function rainValue(slot: Slot, mode: RainMode): number | undefined {
  return mode === "amount" ? slot.precipitation : mode === "probability" ? slot.probability : undefined;
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

/** Degrees or a cardinal string → 16-point compass abbreviation. */
export function cardinal(bearing: number | string | undefined): string | undefined {
  if (typeof bearing === "string") return bearing.toUpperCase();
  if (!defined(bearing)) return undefined;
  return POINTS[Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16];
}
