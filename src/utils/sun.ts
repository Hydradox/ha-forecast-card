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

const timestamp = (value: unknown): number | undefined => {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
};

/** Reads `next_rising`, `next_setting` and the horizon state; `undefined` when the entity gives nothing usable. */
export function readSun(entity: HassEntity | undefined): SunTimes | undefined {
  if (!entity) return undefined;
  const rising = timestamp(entity.attributes.next_rising);
  const setting = timestamp(entity.attributes.next_setting);
  const isUp = entity.state === "above_horizon" ? true : entity.state === "below_horizon" ? false : undefined;
  if (rising === undefined && setting === undefined) return undefined;
  return { rising, setting, isUp };
}

const mod = (value: number, period: number): number => ((value % period) + period) % period;

/**
 * Whether the sun is up at `time`. The next sunrise and sunset repeat every 24 h (a few minutes of drift
 * across a day is invisible at hourly resolution). With only one of them, the horizon state holds until it.
 */
export function isDaytimeAt(sun: SunTimes, time: number): boolean | undefined {
  const { rising, setting, isUp } = sun;
  if (rising === undefined || setting === undefined) {
    const next = rising ?? setting;
    return next !== undefined && isUp !== undefined && time < next ? isUp : undefined;
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
    if (slot.isDaytime !== undefined || slot.start === undefined) return slot;
    const daytime = slot.isCurrent && sun.isUp !== undefined ? sun.isUp : isDaytimeAt(sun, slot.start + HOUR_MS / 2);
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
  const timed = slots.filter((slot) => slot.start !== undefined);
  if (!timed.length) return [];
  const first = Math.min(...timed.map((slot) => slot.start!));
  const last = Math.max(...timed.map((slot) => slot.start!)) + HOUR_MS;
  const events: SunEvent[] = [];
  const candidates: [SunEventKind, number | undefined][] = [["sunrise", sun.rising], ["sunset", sun.setting]];
  for (const [kind, base] of candidates) {
    if (base === undefined) continue;
    for (let time = base + Math.ceil((first - base) / DAY_MS) * DAY_MS; time < last; time += DAY_MS) {
      const index = slots.findIndex((slot) => slot.start !== undefined && time >= slot.start && time < slot.start + HOUR_MS);
      if (index >= 0) events.push({ kind, time, position: index + 0.5 + (time - slots[index].start!) / HOUR_MS });
    }
  }
  return events.sort((a, b) => a.time - b.time);
}
