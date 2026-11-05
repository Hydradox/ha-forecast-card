import { describe, expect, it } from "vitest";
import { createFormatters } from "../src/utils/format";
import {
  barHeight, cardinal, createScale, dailySlots, hourlySlots, rainMode,
} from "../src/utils/forecast-view";
import type { ForecastEntry } from "../src/types/weather";

const fmt = createFormatters("en", { language: "en", time_format: "24", time_zone: "server" }, "UTC");
const hour = (h: number, extra: Partial<ForecastEntry> = {}): ForecastEntry => ({
  datetime: `2026-11-05T${String(h).padStart(2, "0")}:00:00+00:00`, temperature: 10 + h, ...extra,
});

describe("hourlySlots", () => {
  const now = new Date("2026-11-05T14:40:00Z");
  const entries = [hour(13), hour(14), hour(15), hour(16), hour(17)];

  it("starts with Now and skips the entry covering the current hour", () => {
    const slots = hourlySlots(entries, now, 10, fmt, { temperature: 18, condition: "sunny" }, "Now");
    expect(slots.map((s) => s.label)).toEqual(["Now", "15:00", "16:00", "17:00"]);
    expect(slots[0]).toMatchObject({ isCurrent: true, temperature: 18, condition: "sunny" });
  });
  it("limits to the requested count including Now", () => {
    expect(hourlySlots(entries, now, 3, fmt, {}, "Now")).toHaveLength(3);
    expect(hourlySlots(undefined, now, 5, fmt, {}, "Now")).toHaveLength(1);
  });
});

describe("dailySlots", () => {
  const day = (d: number): ForecastEntry => ({ datetime: `2026-11-${String(d).padStart(2, "0")}T00:00:00+00:00`, temperature: 15, templow: 8 });
  it("labels today and drops past days", () => {
    const slots = dailySlots([day(4), day(5), day(6), day(7)], new Date("2026-11-05T09:00:00Z"), 7, fmt, "Today");
    expect(slots.map((s) => s.label)).toEqual(["Today", "Fri", "Sat"]);
    expect(slots[0].isCurrent).toBe(true);
  });
});

describe("geometry helpers", () => {
  it("scales values into the range and centres flat domains", () => {
    const y = createScale(10, 20, 20, 60);
    expect(y(20)).toBe(20);
    expect(y(10)).toBe(60);
    expect(createScale(5, 5, 20, 60)(5)).toBe(40);
  });
  it("keeps drizzle small thanks to the floor", () => {
    expect(barHeight(0.4, 0.8, 2, 70)).toBeCloseTo(14);
    expect(barHeight(4, 4, 2, 80)).toBe(80);
  });
  it("picks the rain source", () => {
    expect(rainMode([{ key: "a", label: "", isCurrent: false, precipitation: 0 }])).toBe("amount");
    expect(rainMode([{ key: "a", label: "", isCurrent: false, probability: 40 }])).toBe("probability");
    expect(rainMode([{ key: "a", label: "", isCurrent: false }])).toBe("none");
  });
  it("converts bearings to compass points", () => {
    expect(cardinal(0)).toBe("N");
    expect(cardinal(112)).toBe("ESE");
    expect(cardinal(-45)).toBe("NW");
    expect(cardinal("sw")).toBe("SW");
    expect(cardinal(undefined)).toBeUndefined();
  });
});
