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
