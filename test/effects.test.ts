import { describe, expect, it } from "vitest";
import { gusts, hailStones, rainDrops, snowFlakes, stars } from "../src/effects/particles";
import { EFFECTS, effectFor } from "../src/effects/specs";

const KNOWN = [
  "sunny", "cloudy", "partlycloudy", "clear-night", "rainy", "pouring", "snowy", "snowy-rainy",
  "hail", "lightning", "lightning-rainy", "fog", "windy", "windy-variant", "exceptional",
];

describe("weather effects", () => {
  it("covers every HA weather condition", () => {
    for (const condition of KNOWN) expect(effectFor(condition), condition).toBeDefined();
    expect(effectFor("unknown-condition")).toBeUndefined();
    expect(effectFor(undefined)).toBeUndefined();
  });

  it("keeps the particle budget small", () => {
    for (const [name, spec] of Object.entries(EFFECTS)) {
      const total = (spec.rain?.count ?? 0) + (spec.snow ?? 0) + (spec.hail ?? 0) + (spec.gusts ?? 0) + (spec.stars ?? 0);
      expect(total, name).toBeLessThanOrEqual(52);
    }
  });

  it("generates deterministic particles", () => {
    expect(rainDrops(26)).toEqual(rainDrops(26));
    expect(rainDrops(26)).toHaveLength(26);
    expect(rainDrops(10, true)[0]).toContain("--h:20px");
    expect(snowFlakes(30)).toHaveLength(30);
    expect(hailStones(24)).toHaveLength(24);
    expect(gusts(9)).toHaveLength(9);
    expect(stars(16)).toHaveLength(16);
  });
});
