import { describe, expect, it } from "vitest";
import { render } from "lit";
import { createTranslator } from "../src/localize";
import { createFormatters } from "../src/utils/format";
import { hourlySlots } from "../src/utils/forecast-view";
import type { ForecastEntry } from "../src/types/weather";
import { isDaytimeAt, readSun, readSunSources, sunChanged, sunEvents, withDaylight } from "../src/utils/sun";
import { renderChart } from "../src/views/chart";
import { parseConfig } from "../src/config";

const fmt = createFormatters("en", { language: "en", time_format: "24", time_zone: "server" }, "UTC");
/** Hours past 23 roll into the next day. */
const at = (h: number, m = 0) => Date.UTC(2026, 10, 5, h, m);
const entry = (h: number, extra: Partial<ForecastEntry> = {}): ForecastEntry => ({
  datetime: new Date(at(h)).toISOString(), temperature: 20 - (h - 14), ...extra,
});
const now = new Date("2026-11-05T14:40:00Z");
const slots = () => hourlySlots([14, 15, 16, 17, 18, 19, 20].map((h) => entry(h, { condition: "sunny" })), now, 10, fmt, { condition: "sunny", temperature: 19 }, "Now");

const sun = { rising: at(7 + 24, 42), setting: at(17, 51), isUp: true };
const entity = (state: string, attributes: Record<string, unknown>) => ({ entity_id: "sun.sun", state, attributes, last_changed: "", last_updated: "" });

describe("readSun", () => {
  it("reads next rising and setting and the horizon state", () => {
    const read = readSun(entity("above_horizon", { next_rising: "2026-11-06T07:42:00+00:00", next_setting: "2026-11-05T17:51:00+00:00" }), at(14, 40));
    expect(read).toEqual({ rising: at(31, 42), setting: at(17, 51), isUp: true });
  });
  it("gives nothing for a missing or unusable entity", () => {
    expect(readSun(undefined)).toBeUndefined();
    expect(readSun(entity("unavailable", {}), at(14))).toBeUndefined();
    expect(readSun(entity("unavailable", { next_setting: "nope" }), at(14))).toBeUndefined();
  });
});

describe("isDaytimeAt", () => {
  it("is day before sunset and night until the next sunrise", () => {
    expect(isDaytimeAt(sun, at(17, 30))).toBe(true);
    expect(isDaytimeAt(sun, at(17, 51))).toBe(false);
    expect(isDaytimeAt(sun, at(23))).toBe(false);
    expect(isDaytimeAt(sun, at(24 + 7, 41))).toBe(false);
    expect(isDaytimeAt(sun, at(24 + 7, 42))).toBe(true);
  });
  it("works when it is already night (sunrise comes first)", () => {
    const night = { rising: at(24 + 7, 42), setting: at(24 + 17, 50), isUp: false };
    expect(isDaytimeAt(night, at(22))).toBe(false);
    expect(isDaytimeAt(night, at(24 + 9))).toBe(true);
  });
  it("with one event left, the state holds until it and flips after", () => {
    const partial = { setting: at(17, 51), isUp: true };
    expect(isDaytimeAt(partial, at(16))).toBe(true);
    expect(isDaytimeAt(partial, at(20))).toBe(false);
  });
  it("polar day or night: the state alone decides and no sunrise is invented", () => {
    const polar = readSun(
      entity("below_horizon", { next_rising: "2026-12-20T10:00:00+00:00", next_setting: "2027-01-20T10:00:00+00:00" }),
      at(14),
    );
    expect(polar).toEqual({ rising: undefined, setting: undefined, isUp: false });
    expect(isDaytimeAt(polar!, at(24 * 5))).toBe(false);
    expect(sunEvents(slots(), polar)).toEqual([]);
  });
  it("drops stale timestamps and keeps the state", () => {
    const stale = readSun(entity("above_horizon", { next_rising: "2020-01-01T00:00:00Z", next_setting: "2020-01-01T10:00:00Z" }), at(14));
    expect(stale).toEqual({ rising: undefined, setting: undefined, isUp: true });
  });
  it("is not thrown off by a slot with an invalid date", () => {
    const list = slots();
    list[1] = { ...list[1], start: Number.NaN };
    expect(sunEvents(list, sun).map((e) => e.kind)).toEqual(["sunset"]);
    expect(withDaylight(list, sun)[1].isDaytime).toBeUndefined();
  });
});

describe("withDaylight", () => {
  it("fills hours without is_daytime, keeps the provider's value, and uses the live state for Now", () => {
    const list = slots();
    list[2] = { ...list[2], isDaytime: false };
    const filled = withDaylight(list, sun);
    // Now, 15, 16 (provider says night), 17 (mid-hour is before 17:51), then after sunset
    expect(filled.map((s) => s.isDaytime)).toEqual([true, true, false, true, false, false, false]);
  });
  it("is a no-op without sun data", () => {
    expect(withDaylight(slots(), undefined).every((s) => s.isDaytime === undefined)).toBe(true);
  });
});

describe("sunEvents", () => {
  it("places the event at its real minute between columns", () => {
    const [event] = sunEvents(slots(), sun);
    // 17:51 is 51 min after the 17:00 column (index 3, centre 3.5)
    expect(event).toMatchObject({ kind: "sunset", time: at(17, 51) });
    expect(event.position).toBeCloseTo(3.5 + 51 / 60, 5);
  });
  it("repeats the times every 24 h over wide charts, forwards and backwards", () => {
    const forecast = Array.from({ length: 49 }, (_, i) => entry(15 + i));
    const past = [3, 2, 1].map((i) => ({ key: `p${i}`, label: "", isCurrent: false, isPast: true, start: at(14) - i * 3_600_000 }));
    const wide = [...past, ...hourlySlots(forecast, now, 49, fmt, {}, "Now")];
    const events = sunEvents(wide, sun);
    expect(events.map((e) => e.kind)).toEqual(["sunset", "sunrise", "sunset", "sunrise"]);
    expect(events.map((e) => e.time)).toEqual([at(17, 51), at(31, 42), at(41, 51), at(55, 42)]);
    // earlier than "Now": yesterday's 07:42 sunrise falls in the recorded hours
    const earlier = [...Array.from({ length: 12 }, (_, i) => ({ key: `p${i}`, label: "", isCurrent: false, isPast: true, start: at(14) - (12 - i) * 3_600_000 })), ...slots()];
    expect(sunEvents(earlier, sun).map((e) => e.time)).toEqual([at(7, 42), at(17, 51)]);
  });
  it("ignores events outside the visible hours", () => {
    expect(sunEvents(slots().slice(0, 2), sun)).toEqual([]);
  });
  it("returns both in time order when both fall inside", () => {
    const wide = hourlySlots(Array.from({ length: 20 }, (_, i) => entry(14 + i)), now, 20, fmt, {}, "Now");
    expect(sunEvents(wide, sun).map((e) => e.kind)).toEqual(["sunset", "sunrise"]);
  });
});

describe("formatters.time", () => {
  it("shows minutes in 24h and 12h", () => {
    expect(fmt.time(new Date(at(17, 51)))).toBe("17:51");
    const twelve = createFormatters("en", { language: "en", time_format: "12", time_zone: "server" }, "UTC");
    expect(twelve.time(new Date(at(17, 51)))).toMatch(/5:51\s?PM/);
  });
});

describe("sunChanged", () => {
  const e = (state: string, extra: Record<string, unknown> = {}) => entity(state, { next_rising: "a", next_setting: "b", elevation: 10, ...extra });
  it("ignores elevation and azimuth updates, reacts to state and next times", () => {
    expect(sunChanged(e("above_horizon"), e("above_horizon", { elevation: 11 }))).toBe(false);
    expect(sunChanged(e("above_horizon"), e("below_horizon"))).toBe(true);
    expect(sunChanged(e("above_horizon"), e("above_horizon", { next_setting: "c" }))).toBe(true);
    expect(sunChanged(undefined, e("above_horizon"))).toBe(true);
  });
});

describe("sun_entity config", () => {
  it("accepts sun.* and rejects other domains", () => {
    expect(parseConfig({ entity: "weather.home", sun_entity: "sun.sun" }).sun_entity).toBe("sun.sun");
    expect(() => parseConfig({ entity: "weather.home", sun_entity: "sensor.sun" })).toThrow("sun.*");
    expect(() => parseConfig({ entity: "weather.home", sun_entity: "" })).not.toThrow();
  });
});

describe("hourly chart marker", () => {
  const input = (overrides = {}) => ({
    kind: "hourly" as const, slots: withDaylight(slots(), sun), width: 540, temperatureUnit: "°C", precipitationUnit: "mm",
    thresholds: { cold: 0, hot: 35 }, fmt, localize: createTranslator("en"), sun, ...overrides,
  });
  const draw = (i: ReturnType<typeof input>) => {
    const host = document.createElement("div");
    render(renderChart(i), host);
    return host;
  };
  it("draws the dashed line, label and aria text", () => {
    const host = draw(input());
    expect(host.querySelector(".sun-line")).not.toBeNull();
    expect(host.querySelector(".sun-label text")?.textContent).toBe("17:51");
    expect(host.querySelector(".sun-label use")?.getAttribute("href")).toBe("#hfc-sunset");
    expect(host.querySelector("svg[role=img]")?.getAttribute("aria-label")).toContain("Sunset at 17:51");
  });
  it("draws nothing without sun data or in the daily view", () => {
    expect(draw(input({ sun: undefined })).querySelector(".sun-line")).toBeNull();
    expect(draw(input({ kind: "daily" })).querySelector(".sun-line")).toBeNull();
  });
  it("moves a value under the label below its point", () => {
    // Sunset right over the first, highest value: the label strip and "20°" overlap.
    const early = { ...sun, setting: at(14, 50) };
    const host = draw(input({ sun: early, slots: withDaylight(slots(), early) }));
    const labels = [...host.querySelectorAll("text.label")].map((t) => Number(t.getAttribute("y")));
    const points = [...host.querySelectorAll("circle.dot")].map((c) => Number(c.getAttribute("cy")));
    expect(labels.some((y, i) => y > points[i])).toBe(true);
  });
});

describe("readSunSources", () => {
  const sensor = (state: string) => ({ entity_id: "sensor.home_next_rising", state, attributes: {}, last_changed: "", last_updated: "" });
  it("reads timestamp sensors without a sun entity", () => {
    const read = readSunSources({ rising: sensor("2026-11-06T07:42:00+00:00"), setting: sensor("2026-11-05T17:51:00+00:00") }, at(14, 40));
    expect(read).toEqual({ rising: at(31, 42), setting: at(17, 51), isUp: undefined });
  });
  it("lets sensors override the sun entity and falls back to it", () => {
    const sunEntity = entity("above_horizon", { next_rising: "2026-11-06T07:42:00+00:00", next_setting: "2026-11-05T17:51:00+00:00" });
    expect(readSunSources({ sun: sunEntity, setting: sensor("2026-11-05T18:00:00+00:00") }, at(14, 40))).toEqual({ rising: at(31, 42), setting: at(18), isUp: true });
  });
  it("ignores unusable sensors", () => {
    expect(readSunSources({ rising: sensor("unavailable") }, at(14))).toBeUndefined();
  });
});
describe("sun config", () => {
  it("accepts any entity for sunrise_entity and sunset_entity", () => {
    expect(parseConfig({ entity: "weather.home", sunrise_entity: "sensor.home_next_rising", sunset_entity: "sensor.home_next_setting" }).sunrise_entity).toBe("sensor.home_next_rising");
  });
});
