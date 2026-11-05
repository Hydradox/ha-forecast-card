import { describe, expect, it } from "vitest";
import { temperatureColor } from "../src/utils/temperature";

describe("temperatureColor", () => {
  it("returns stop colors exactly", () => {
    expect(temperatureColor(0)).toBe("rgb(3 155 229)");
    expect(temperatureColor(24)).toBe("rgb(253 216 53)");
  });
  it("clamps outside the ramp", () => {
    expect(temperatureColor(-40)).toBe(temperatureColor(-10));
    expect(temperatureColor(60)).toBe(temperatureColor(42));
  });
  it("interpolates between stops", () => {
    expect(temperatureColor(5)).toBe("rgb(21 161 192)");
  });
});

import { DEFAULT_THRESHOLDS_C, defaultThresholds, resolveThresholds } from "../src/utils/temperature";

describe("thresholds", () => {
  it("declares defaults once and derives the Fahrenheit ones", () => {
    expect(DEFAULT_THRESHOLDS_C).toEqual({ cold: 0, hot: 35 });
    expect(defaultThresholds("°C")).toEqual({ cold: 0, hot: 35 });
    expect(defaultThresholds("°F")).toEqual({ cold: 32, hot: 95 });
  });
  it("resolves config values from the display unit to °C", () => {
    expect(resolveThresholds({}, "°F")).toEqual({ cold: 0, hot: 35 });
    expect(resolveThresholds({ cold_threshold: 50, hot_threshold: 86 }, "°F")).toEqual({ cold: 10, hot: 30 });
  });
  it("falls back to defaults when cold >= hot", () => {
    expect(resolveThresholds({ cold_threshold: 40 }, "°C")).toEqual(DEFAULT_THRESHOLDS_C);
  });
  it("pins cold and hot to the cold/hot ends of the ramp", () => {
    const custom = { cold: 10, hot: 25 };
    expect(temperatureColor(10, custom)).toBe(temperatureColor(0));
    expect(temperatureColor(25, custom)).toBe(temperatureColor(35));
    expect(temperatureColor(20, custom)).toBe(temperatureColor(0 + (10 / 15) * 35));
  });
  it("is the identity with the defaults", () => {
    expect(temperatureColor(17, DEFAULT_THRESHOLDS_C)).toBe(temperatureColor(17));
  });
});
