/** Pure helpers turning recorder history into hourly "past" slots. No DOM, fully testable. */
import type { Formatters } from "./format";
import type { Slot } from "./forecast-view";

const HOUR_MS = 3_600_000;

/** One state of an entity as returned by `history/history_during_period`. */
export interface HistoryState {
  /** state value */
  s: string;
  /** attributes (only when requested) */
  a?: Record<string, unknown>;
  /** last_changed, seconds since epoch */
  lc?: number;
  /** last_updated, seconds since epoch */
  lu?: number;
}

export interface HistoryPoint {
  time: number;
  value: number;
  condition?: string;
}

const INVALID = new Set(["unavailable", "unknown", "", "none"]);

const finite = (raw: unknown): number | undefined => {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

/**
 * Normalises history rows. A sensor reports its temperature as the state; a weather entity reports the
 * condition as the state and the temperature as an attribute.
 */
export function toPoints(states: readonly HistoryState[] | undefined, source: "state" | "attribute"): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const entry of states ?? []) {
    const time = (entry.lu ?? entry.lc) as number | undefined;
    if (time === undefined) continue;
    const raw = source === "state" ? entry.s : entry.a?.temperature;
    const value = finite(raw);
    if (value === undefined) continue;
    points.push({
      time: time * 1000,
      value,
      condition: source === "attribute" && !INVALID.has(String(entry.s).toLowerCase()) ? entry.s : undefined,
    });
  }
  return points.sort((a, b) => a.time - b.time);
}

/** Last known condition at or before `time` (weather history states). */
export function conditionAt(states: readonly HistoryState[] | undefined, time: number): string | undefined {
  let found: string | undefined;
  for (const entry of states ?? []) {
    const at = ((entry.lu ?? entry.lc) as number | undefined) ?? Infinity;
    if (at * 1000 > time) break;
    found = INVALID.has(String(entry.s).toLowerCase()) ? found : entry.s;
  }
  return found;
}

/**
 * Past daily slots, oldest first: the `count` most recent days before today that have readings, each with its
 * highest and lowest temperature. The condition is the one recorded when the day peaked.
 */
export function pastDailySlots(
  temperature: readonly HistoryPoint[],
  weatherStates: readonly HistoryState[] | undefined,
  now: Date,
  count: number,
  fmt: Formatters,
): Slot[] {
  if (count < 1) return [];
  const today = fmt.dayKey(now);
  const days = new Map<string, HistoryPoint[]>();
  for (const point of temperature) {
    const key = fmt.dayKey(new Date(point.time));
    if (key >= today) continue;
    const group = days.get(key);
    if (group) group.push(point);
    else days.set(key, [point]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-count)
    .map(([key, points]) => {
      const peak = points.reduce((best, p) => (p.value > best.value ? p : best));
      const low = Math.min(...points.map((p) => p.value));
      return {
        key: `past-${key}`,
        label: fmt.weekday(new Date(peak.time)),
        isCurrent: false,
        isPast: true,
        temperature: Math.round(peak.value * 10) / 10,
        templow: Math.round(low * 10) / 10,
        condition: conditionAt(weatherStates, peak.time),
        isDaytime: true,
      };
    });
}

/**
 * Past hourly slots, oldest first, covering the `count` hours before the current one. Each hour takes the
 * average of the readings inside it, or the last known value when there were none. Hours before the first
 * reading are skipped, so a young recorder just yields fewer columns.
 */
export function pastSlots(
  temperature: readonly HistoryPoint[],
  weatherStates: readonly HistoryState[] | undefined,
  now: Date,
  count: number,
  fmt: Formatters,
): Slot[] {
  if (count < 1 || !temperature.length) return [];
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const slots: Slot[] = [];
  let cursor = 0;
  let carried: number | undefined;

  for (let i = count; i >= 1; i--) {
    const start = currentHour - i * HOUR_MS;
    const end = start + HOUR_MS;
    const inside: number[] = [];
    while (cursor < temperature.length && temperature[cursor].time < end) {
      if (temperature[cursor].time >= start) inside.push(temperature[cursor].value);
      carried = temperature[cursor].value;
      cursor++;
    }
    const value = inside.length ? inside.reduce((sum, v) => sum + v, 0) / inside.length : carried;
    if (value === undefined) continue;
    slots.push({
      key: `past-${start}`,
      label: fmt.hour(new Date(start)),
      isCurrent: false,
      isPast: true,
      temperature: Math.round(value * 10) / 10,
      condition: conditionAt(weatherStates, start + HOUR_MS / 2),
    });
  }
  return slots;
}
