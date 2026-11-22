/** Sunrise and sunset from HA's Sun integration (`sun.*`). Pure: no DOM, fully testable. */
import type { HassEntity } from "../types/ha";
import type { Slot } from "./forecast-view";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface SunTimes {
  /** Next sunrise / sunset (ms). Only the next of each is known, so later days are extrapolated by 24 h. */
  rising?: number;
  setting?: number;
  /** Sun above the horizon right now. */
  isUp?: boolean;
}

export type SunEventKind = "sunrise" | "sunset";

export interface SunEvent {
  kind: SunEventKind;
  time: number;
  /** Position in columns from the left edge of the chart (a slot centre is `index + 0.5`). */
  position: number;
}

/** Next sunrise or sunset is never further than a day away; beyond this the value is stale or polar. */
const MAX_DISTANCE_MS = 26 * HOUR_MS;

const timestamp = (value: unknown, now: number): number | undefined => {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) && Math.abs(time - now) <= MAX_DISTANCE_MS ? time : undefined;
};

/**
 * Reads `next_rising`, `next_setting` and the horizon state. An event more than 26 h from `now` is dropped:
 * in polar day or night it is weeks away, and repeating it every 24 h would invent sunrises. Then only the
 * horizon state remains, which is right for the whole chart. `undefined` when nothing usable is left.
 */
export function readSun(entity: HassEntity | undefined, now: number = Date.now()): SunTimes | undefined {
  if (!entity) return undefined;
  const rising = timestamp(entity.attributes.next_rising, now);
  const setting = timestamp(entity.attributes.next_setting, now);
  const isUp = entity.state === "above_horizon" ? true : entity.state === "below_horizon" ? false : undefined;
  if (rising === undefined && setting === undefined && isUp === undefined) return undefined;
  return { rising, setting, isUp };
}

/** Whether `next` and `previous` differ in what the card draws (the sun entity also updates its elevation every minute). */
export function sunChanged(previous: HassEntity | undefined, next: HassEntity | undefined): boolean {
  if (previous === next) return false;
  const keys = ["next_rising", "next_setting"] as const;
  return previous?.state !== next?.state || keys.some((key) => previous?.attributes[key] !== next?.attributes[key]);
}

const mod = (value: number, period: number): number => ((value % period) + period) % period;

/**
 * Whether the sun is up at `time`. The next sunrise and sunset repeat every 24 h (a few minutes of drift
 * across a day is invisible at hourly resolution). With fewer, the horizon state decides (see `readSun`).
 */
export function isDaytimeAt(sun: SunTimes, time: number): boolean | undefined {
  const { rising, setting, isUp } = sun;
  if (rising === undefined || setting === undefined) {
    // One event left (the other is far away or missing): the state holds until it, and flips after.
    const next = rising ?? setting;
    if (isUp === undefined) return undefined;
    return next === undefined || time < next ? isUp : !isUp;
  }
  // Night starts at a sunset and lasts until the next sunrise.
  return mod(time - setting, DAY_MS) >= mod(rising - setting, DAY_MS);
}

/**
 * Fills `isDaytime` where the forecast left it out (most hourly providers do), so a clear hour after sunset
 * shows the moon. Entries that carry their own value are kept; recorded hours are filled too.
 */
export function withDaylight(slots: readonly Slot[], sun: SunTimes | undefined): Slot[] {
  if (!sun) return [...slots];
  return slots.map((slot) => {
    if (slot.isDaytime !== undefined || !Number.isFinite(slot.start)) return slot;
    const daytime = slot.isCurrent && sun.isUp !== undefined ? sun.isUp : isDaytimeAt(sun, slot.start! + HOUR_MS / 2);
    return daytime === undefined ? slot : { ...slot, isDaytime: daytime };
  });
}

/**
 * Sunrise and sunset inside the hourly chart, recorded hours included. The Sun integration only gives the next
 * of each, so the same times are repeated every 24 h backwards and forwards (the drift from one day to the next
 * is a minute or two) to cover wide charts. `position` is fractional, so the marker sits at the real minute.
 */
export function sunEvents(slots: readonly Slot[], sun: SunTimes | undefined): SunEvent[] {
  if (!sun) return [];
  const timed = slots.filter((slot) => Number.isFinite(slot.start));
  if (!timed.length) return [];
  const first = Math.min(...timed.map((slot) => slot.start!));
  const last = Math.max(...timed.map((slot) => slot.start!)) + HOUR_MS;
  const events: SunEvent[] = [];
  const candidates: [SunEventKind, number | undefined][] = [["sunrise", sun.rising], ["sunset", sun.setting]];
  for (const [kind, base] of candidates) {
    if (base === undefined) continue;
    for (let time = base + Math.ceil((first - base) / DAY_MS) * DAY_MS; time < last; time += DAY_MS) {
      const index = slots.findIndex((slot) => Number.isFinite(slot.start) && time >= slot.start! && time < slot.start! + HOUR_MS);
      if (index >= 0) events.push({ kind, time, position: index + 0.5 + (time - slots[index].start!) / HOUR_MS });
    }
  }
  return events.sort((a, b) => a.time - b.time);
}
