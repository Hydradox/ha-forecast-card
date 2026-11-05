import { describe, expect, it } from "vitest";
import { compactConfig, parseConfig } from "../src/config";

describe("parseConfig", () => {
  it("applies defaults", () => {
    const config = parseConfig({ type: "custom:ha-forecast-card", entity: "weather.home" });
    expect(config.default_view).toBe("hourly");
    expect(config.hours_to_show).toBe(10);
  });
  it("rejects non-weather entities", () => {
    expect(() => parseConfig({ entity: "sensor.x" })).toThrow();
  });
  it("rejects invalid view and counts", () => {
    expect(() => parseConfig({ entity: "weather.a", default_view: "weekly" })).toThrow();
    expect(() => parseConfig({ entity: "weather.a", days_to_show: 0 })).toThrow();
  });
  it("defaults show_name and leaves thresholds/actions unset", () => {
    const config = parseConfig({ entity: "weather.a" });
    expect(config.show_name).toBe(true);
    expect(config.cold_threshold).toBeUndefined();
    expect(config.tap_action).toBeUndefined();
  });
  it("validates thresholds, show_name and actions", () => {
    expect(() => parseConfig({ entity: "weather.a", cold_threshold: "5" })).toThrow();
    expect(() => parseConfig({ entity: "weather.a", show_name: "no" })).toThrow();
    expect(() => parseConfig({ entity: "weather.a", tap_action: { action: "nope" } })).toThrow();
    expect(parseConfig({ entity: "weather.a", tap_action: { action: "none" } }).tap_action).toEqual({ action: "none" });
  });
});

describe("compactConfig", () => {
  it("drops defaults and empty values only", () => {
    const out = compactConfig(
      { type: "x", entity: "weather.a", name: "", show_name: true, hours_to_show: 12, cold_threshold: 32, hot_threshold: 90 },
      { show_name: true, hours_to_show: 10, cold_threshold: 32, hot_threshold: 95 },
    );
    expect(out).toEqual({ type: "x", entity: "weather.a", hours_to_show: 12, hot_threshold: 90 });
  });
});

describe("threshold order", () => {
  it("rejects hot <= cold", () => {
    expect(() => parseConfig({ entity: "weather.a", cold_threshold: 20, hot_threshold: 20 })).toThrow(/greater/);
    expect(() => parseConfig({ entity: "weather.a", cold_threshold: 20, hot_threshold: 10 })).toThrow(/greater/);
    expect(parseConfig({ entity: "weather.a", cold_threshold: 10, hot_threshold: 20 }).hot_threshold).toBe(20);
  });
});
