import { describe, expect, it } from "vitest";
import { convertTemperature, temperatureUnit, toCelsius } from "../src/utils/units";

describe("temperature units", () => {
  it("converts both ways and round-trips", () => {
    expect(convertTemperature(0, "°C", "°F")).toBe(32);
    expect(convertTemperature(95, "°F", "°C")).toBe(35);
    expect(convertTemperature(21.5, "°C", "°F")).toBeCloseTo(70.7);
    expect(convertTemperature(convertTemperature(18.3, "°C", "°F"), "°F", "°C")).toBeCloseTo(18.3);
  });
  it("treats unknown units as Celsius", () => {
    expect(temperatureUnit(undefined)).toBe("°C");
    expect(toCelsius(20, "K")).toBe(20);
  });
});
