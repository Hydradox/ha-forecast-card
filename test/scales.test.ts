import { describe, expect, it } from "vitest";
import { getLevel } from "../src/utils/scales";
import { toCelsius, toKmh } from "../src/utils/units";

describe("getLevel", () => {
  it.each([
    ["humidity", 25, 0],
    ["humidity", 35, 1],
    ["humidity", 50, 2],
    ["humidity", 67, 3],
    ["humidity", 85, 4],
    ["wind", 10, 0],
    ["wind", 28, 1],
    ["wind", 48, 2],
    ["wind", 70, 3],
    ["wind", 95, 4],
    ["uv", 1.7, 0],
    ["uv", 4.2, 1],
    ["uv", 6.5, 2],
    ["uv", 9, 3],
    ["uv", 11.5, 4],
  ] as const)("%s %s → level %s", (metric, value, level) => {
    expect(getLevel(metric, value)).toBe(level);
  });
});

describe("units", () => {
  it("converts to Celsius", () => {
    expect(toCelsius(32, "°F")).toBe(0);
    expect(toCelsius(18, "°C")).toBe(18);
  });
  it("converts to km/h", () => {
    expect(toKmh(10, "m/s")).toBeCloseTo(36);
    expect(toKmh(10, undefined)).toBe(10);
  });
});
