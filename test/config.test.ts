import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";

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
});
