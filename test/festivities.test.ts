import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";
import { ART } from "../src/festivities/art";
import { FESTIVITIES, FIXED_WINDOWS, compactFestivityRules, easterSunday, festivityOn, festivityRulesValid, parseMonthDay, resolveFestivity } from "../src/festivities/calendar";
import { PALETTES } from "../src/festivities/palettes";

const on = (y: number, m: number, d: number) => festivityOn(new Date(y, m - 1, d));

describe("festivity calendar", () => {
  it("computes Easter Sunday", () => {
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
  });

  it("covers the fixed windows, including the turn of the year", () => {
    expect(on(2026, 10, 23)).toBeUndefined();
    expect(on(2026, 10, 24)).toBe("halloween");
    expect(on(2026, 11, 1)).toBe("halloween");
    expect(on(2026, 11, 2)).toBeUndefined();
    expect(on(2026, 12, 1)).toBe("christmas");
    expect(on(2026, 12, 26)).toBe("christmas");
    expect(on(2026, 12, 27)).toBe("new_year");
    expect(on(2027, 1, 1)).toBe("new_year");
    expect(on(2027, 1, 2)).toBe("epiphany");
    expect(on(2027, 1, 6)).toBe("epiphany");
    expect(on(2027, 1, 7)).toBeUndefined();
    expect(on(2026, 2, 14)).toBe("valentine");
    // Fallas is off by default (see the rules tests below for turning it on).
    expect(on(2026, 3, 15)).toBeUndefined();
    expect(festivityOn(new Date(2026, 2, 15), { fallas: { enabled: true } })).toBe("fallas");
    expect(festivityOn(new Date(2026, 2, 19), { fallas: { enabled: true } })).toBe("fallas");
  });

  it("follows movable dates", () => {
    // Easter 2026 is April 5: Palm Sunday March 29 to Easter Monday April 6.
    expect(on(2026, 3, 28)).toBeUndefined();
    expect(on(2026, 3, 29)).toBe("easter");
    expect(on(2026, 4, 6)).toBe("easter");
    expect(on(2026, 4, 7)).toBeUndefined();
    // Carnival 2027: Easter March 28 → Thursday Feb 4 to Tuesday Feb 9.
    expect(on(2027, 2, 3)).toBeUndefined();
    expect(on(2027, 2, 4)).toBe("carnival");
    expect(on(2027, 2, 9)).toBe("carnival");
    expect(on(2027, 2, 10)).toBe("valentine"); // the next window starts the day after
  });

  it("lets fixed dates win when windows overlap", () => {
    // Carnival 2026 (Feb 12–17) overlaps Valentine's Day.
    expect(on(2026, 2, 13)).toBe("valentine");
    expect(on(2026, 2, 15)).toBe("carnival");
  });

  it("resolves the option", () => {
    const states: Record<string, string> = { "input_select.fest": "easter", "input_select.off": "none" };
    const stateOf = (id: string) => states[id];
    const halloween = new Date(2026, 9, 30);
    expect(resolveFestivity(undefined, stateOf, halloween)).toBe("halloween");
    expect(resolveFestivity("auto", stateOf, halloween)).toBe("halloween");
    expect(resolveFestivity("none", stateOf, halloween)).toBeUndefined();
    expect(resolveFestivity("fallas", stateOf, halloween)).toBe("fallas");
    expect(resolveFestivity("input_select.fest", stateOf, halloween)).toBe("easter");
    expect(resolveFestivity("input_select.off", stateOf, halloween)).toBeUndefined();
    expect(resolveFestivity("input_select.missing", stateOf, halloween)).toBeUndefined();
    expect(resolveFestivity("nonsense", stateOf, halloween)).toBeUndefined();
  });
});

describe("festivity assets", () => {
  it("has art and a palette for every festivity", () => {
    for (const id of FESTIVITIES) {
      expect(ART[id].layers.length, id).toBeGreaterThan(100);
      expect(ART[id].brand, id).toContain("<svg");
      expect(PALETTES[id].light.card, id).toMatch(/^#/);
      expect(PALETTES[id].dark.accent, id).toMatch(/^#/);
    }
  });
});

describe("festivity config", () => {
  const base = { type: "custom:ha-forecast-card", entity: "weather.home" };
  it("defaults to auto and validates", () => {
    expect(parseConfig(base).festivity).toBe("auto");
    expect(parseConfig({ ...base, festivity: "halloween" }).festivity).toBe("halloween");
    expect(parseConfig({ ...base, festivity: "none" }).festivity).toBe("none");
    expect(parseConfig({ ...base, festivity: "input_select.fest" }).festivity).toBe("input_select.fest");
    expect(() => parseConfig({ ...base, festivity: "eid" })).toThrow();
    expect(() => parseConfig({ ...base, festivity: 3 })).toThrow();
  });
});

describe("festivity tiling", () => {
  it("repeats garlands and bottom strips so wide cards are covered", async () => {
    const { tile } = await import("../src/festivities/render");
    const count = (text: string, needle: string) => text.split(needle).length - 1;
    for (const id of FESTIVITIES) {
      const out = tile(ART[id].layers);
      if (id !== "halloween") expect(count(out, 'width="360" height="34"'), id).toBe(3);
      if (id !== "christmas") expect(count(out, 'style="flex: none"'), id).toBe(3);
    }
    // The Epiphany guiding star is a one-off.
    expect(count(tile(ART.epiphany.layers), 'translate(-60  0)')).toBe(1);
  });
});

describe("festivity rules", () => {
  it("skips disabled festivities and falls through to the next one", () => {
    expect(festivityOn(new Date(2026, 11, 28))).toBe("new_year");
    expect(festivityOn(new Date(2026, 11, 28), { new_year: { enabled: false } })).toBeUndefined();
    expect(festivityOn(new Date(2026, 0, 1), { new_year: { enabled: false } })).toBeUndefined();
  });

  it("moves fixed windows, including ones that wrap the year", () => {
    expect(festivityOn(new Date(2026, 9, 20))).toBeUndefined();
    expect(festivityOn(new Date(2026, 9, 20), { halloween: { start: "10-20" } })).toBe("halloween");
    expect(festivityOn(new Date(2026, 11, 20), { new_year: { start: "12-20" }, christmas: { enabled: false } })).toBe("new_year");
  });

  it("moves movable windows by offsets from Easter", () => {
    // Easter 2026 is April 5; Palm Sunday March 29.
    expect(festivityOn(new Date(2026, 2, 28))).toBeUndefined();
    expect(festivityOn(new Date(2026, 2, 28), { easter: { start_offset: -8 } })).toBe("easter");
  });

  it("applies rules to auto only; a named festivity is always shown", () => {
    const rules = { halloween: { enabled: false } };
    expect(resolveFestivity("auto", () => undefined, new Date(2026, 9, 30), rules)).toBeUndefined();
    expect(resolveFestivity("halloween", () => undefined, new Date(2026, 5, 1), rules)).toBe("halloween");
  });

  it("validates and compacts rules", () => {
    expect(festivityRulesValid({ fallas: { start: "03-01" }, easter: { end_offset: 3 } })).toBe(true);
    for (const bad of [{ fallas: { start: "02-30" } }, { fallas: { start_offset: 1 } }, { easter: { start: "03-01" } }, { nope: {} }, { easter: { end_offset: 1.5 } }]) {
      expect(festivityRulesValid(bad)).toBe(false);
    }
    expect(parseMonthDay("02-29")).toBe(229);
    expect(compactFestivityRules({ fallas: { enabled: false } })).toBeUndefined();
    expect(compactFestivityRules({ fallas: { enabled: true } })).toEqual({ fallas: { enabled: true } });
    expect(compactFestivityRules({ halloween: { enabled: true, start: "10-24", end: "11-01" } })).toBeUndefined();
    expect(compactFestivityRules({ halloween: { enabled: false, start: "10-24", end: "11-02" } })).toEqual({ halloween: { enabled: false, end: "11-02" } });
  });
});

describe("config: weather_effects and festivities", () => {
  const base = { entity: "weather.a" };
  it("defaults effects on and validates the new options", () => {
    expect(parseConfig(base).weather_effects).toBe(true);
    expect(parseConfig({ ...base, weather_effects: false }).weather_effects).toBe(false);
    expect(() => parseConfig({ ...base, weather_effects: "no" })).toThrow();
    expect(() => parseConfig({ ...base, festivities: { halloween: { start: "13-01" } } })).toThrow();
    expect(parseConfig({ ...base, festivities: { halloween: { enabled: false } } }).festivities).toEqual({ halloween: { enabled: false } });
  });
});

describe("festivity order", () => {
  it("lists festivities in calendar order (keep FESTIVITIES sorted by start date)", () => {
    // Movable ones are placed by 2026, a typical year (carnival starts Feb 12, Easter week on Mar 29).
    const easter = easterSunday(2026);
    const start = (id: (typeof FESTIVITIES)[number]): number => {
      if (id === "easter" || id === "carnival") {
        const offset = id === "easter" ? -7 : -52;
        const d = new Date(2026, easter.month - 1, easter.day + offset);
        return (d.getMonth() + 1) * 100 + d.getDate();
      }
      return parseMonthDay(FIXED_WINDOWS[id][0])!;
    };
    const days = FESTIVITIES.map(start);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
});
