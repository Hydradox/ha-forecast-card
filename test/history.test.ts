import { describe, expect, it } from "vitest";
import { columnWidth } from "../src/views/chart";
import { createFormatters } from "../src/utils/format";
import { dailySlots, hourlySlots } from "../src/utils/forecast-view";
import { conditionAt, pastDailySlots, pastSlots, toPoints } from "../src/utils/history";
import type { HistoryState } from "../src/utils/history";

const fmt = createFormatters("en", { language: "en", time_format: "24", time_zone: "server" }, "UTC");
const at = (iso: string) => new Date(iso).getTime() / 1000;
const now = new Date("2026-11-05T14:40:00Z");

describe("toPoints", () => {
  it("reads a sensor from its state and skips invalid readings", () => {
    const points = toPoints(
      [
        { s: "unavailable", lu: at("2026-11-05T10:00:00Z") },
        { s: "11.5", lu: at("2026-11-05T11:00:00Z") },
      ],
      "state",
    );
    expect(points).toEqual([{ time: at("2026-11-05T11:00:00Z") * 1000, value: 11.5, condition: undefined }]);
  });
  it("reads a weather entity from its temperature attribute", () => {
    const points = toPoints([{ s: "rainy", a: { temperature: 9 }, lu: at("2026-11-05T11:00:00Z") }], "attribute");
    expect(points[0]).toMatchObject({ value: 9, condition: "rainy" });
  });
});

describe("pastSlots", () => {
  const states: HistoryState[] = [
    { s: "10", lu: at("2026-11-05T11:10:00Z") },
    { s: "12", lu: at("2026-11-05T11:50:00Z") },
    { s: "14", lu: at("2026-11-05T13:20:00Z") },
  ];
  const points = toPoints(states, "state");

  it("averages inside an hour, carries the last value over empty hours and skips hours before the first reading", () => {
    const slots = pastSlots(points, undefined, now, 4, fmt);
    expect(slots.map((s) => [s.label, s.temperature])).toEqual([
      ["11:00", 11],
      ["12:00", 12],
      ["13:00", 14],
    ]);
    expect(slots.every((s) => s.isPast && !s.isCurrent)).toBe(true);
  });
  it("is empty when disabled or without data", () => {
    expect(pastSlots(points, undefined, now, 0, fmt)).toEqual([]);
    expect(pastSlots([], undefined, now, 4, fmt)).toEqual([]);
  });
  it("takes conditions from the weather history", () => {
    const weather: HistoryState[] = [{ s: "rainy", lu: at("2026-11-05T10:00:00Z") }, { s: "cloudy", lu: at("2026-11-05T12:40:00Z") }];
    expect(conditionAt(weather, at("2026-11-05T11:30:00Z") * 1000)).toBe("rainy");
    expect(pastSlots(points, weather, now, 4, fmt).map((s) => s.condition)).toEqual(["rainy", "rainy", "cloudy"]);
  });
  it("precedes Now without counting against the requested hours", () => {
    const past = pastSlots(points, undefined, now, 4, fmt);
    const slots = hourlySlots([], now, 3, fmt, { temperature: 18 }, "Now", past);
    expect(slots.map((s) => s.label)).toEqual(["11:00", "12:00", "13:00", "Now"]);
  });
});

describe("pastDailySlots", () => {
  const points = toPoints(
    [
      { s: "8", lu: at("2026-11-02T06:00:00Z") },
      { s: "15", lu: at("2026-11-02T15:00:00Z") },
      { s: "7", lu: at("2026-11-03T05:00:00Z") },
      { s: "12", lu: at("2026-11-03T14:00:00Z") },
      { s: "9", lu: at("2026-11-04T06:00:00Z") },
      { s: "13", lu: at("2026-11-04T13:00:00Z") },
      { s: "11", lu: at("2026-11-05T09:00:00Z") },
    ],
    "state",
  );
  const weather: HistoryState[] = [{ s: "rainy", lu: at("2026-11-01T00:00:00Z") }, { s: "sunny", lu: at("2026-11-04T12:00:00Z") }];

  it("keeps the most recent past days with their high and low, excluding today", () => {
    const slots = pastDailySlots(points, weather, now, 2, fmt);
    expect(slots.map((s) => [s.label, s.temperature, s.templow])).toEqual([
      ["Tue", 12, 7],
      ["Wed", 13, 9],
    ]);
    expect(slots.map((s) => s.condition)).toEqual(["rainy", "sunny"]);
  });
  it("is empty when disabled and precedes the forecast days", () => {
    expect(pastDailySlots(points, weather, now, 0, fmt)).toEqual([]);
    const forecast = [{ datetime: "2026-11-05T00:00:00+00:00", temperature: 14, templow: 9 }];
    const slots = dailySlots(forecast, now, 7, fmt, "Today", pastDailySlots(points, weather, now, 1, fmt));
    expect(slots.map((s) => s.label)).toEqual(["Wed", "Today"]);
  });
});

describe("columnWidth", () => {
  it("is shared by both views: fills the card, never below the minimum", () => {
    expect(columnWidth(440, 8, true)).toBe(55);
    expect(columnWidth(440, 11, true)).toBe(54);
    expect(columnWidth(440, 1, true)).toBe(110);
    expect(columnWidth(440, 1, false)).toBe(440);
  });
  it("can cap how many columns are visible at once", () => {
    const rules = { minColumn: 54, minVisible: 4, maxVisible: 7 };
    expect(columnWidth(448, 11, true, rules)).toBe(64);
    expect(columnWidth(448, 5, true, rules)).toBe(89.6);
  });
});
