import { describe, expect, it } from "vitest";
import { compactConfig, parseConfig, parseLocations } from "../src/config";

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

describe("parseLocations", () => {
  it("keeps a flat config as a single place", () => {
    const places = parseLocations({ type: "x", entity: "weather.a", show_name: false });
    expect(places).toHaveLength(1);
    expect(places[0].show_name).toBe(false);
  });

  it("gives every place the full set of options and defaults", () => {
    const places = parseLocations({
      type: "x",
      locations: [
        { entity: "weather.a", name: "Home", days_to_show: 3 },
        { entity: "weather.b", name: "Beach", camera_entity: "camera.beach" },
      ],
    });
    expect(places.map((p) => p.entity)).toEqual(["weather.a", "weather.b"]);
    expect(places[0].days_to_show).toBe(3);
    expect(places[1].days_to_show).toBe(7);
    expect(places[1].camera_entity).toBe("camera.beach");
  });

  it("forces the name line on with several places, since it hosts the selector", () => {
    const places = parseLocations({
      type: "x",
      locations: [
        { entity: "weather.a", show_name: false },
        { entity: "weather.b", show_name: false },
      ],
    });
    expect(places.every((p) => p.show_name)).toBe(true);
    expect(parseLocations({ type: "x", locations: [{ entity: "weather.a", show_name: false }] })[0].show_name).toBe(false);
  });

  it("shares the language and reports which place is invalid", () => {
    const places = parseLocations({ type: "x", language: "es", locations: [{ entity: "weather.a" }] });
    expect(places[0].language).toBe("es");
    expect(() => parseLocations({ type: "x", locations: [] })).toThrow(/locations/);
    expect(() => parseLocations({ type: "x", locations: [{ entity: "weather.a" }, { entity: "sensor.b" }] })).toThrow(/locations\[1\]/);
  });
});
