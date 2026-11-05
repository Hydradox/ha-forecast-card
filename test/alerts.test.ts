import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";
import type { HassEntity } from "../src/types/ha";
import { alertKind, collectAlerts, compactAlerts, formatWindow, parseAlertsConfig, readAlerts } from "../src/utils/alerts";
import { createFormatters } from "../src/utils/format";

const entity = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id,
  state,
  attributes,
  last_changed: "",
  last_updated: "",
});
const NOW = new Date("2026-11-05T12:00:00Z");

describe("alert adapters", () => {
  it("maps Meteoalarm awareness colours to levels and ignores green", () => {
    const base = { event: "Rain", headline: "Heavy rain", expires: "2026-11-05T23:59:00Z", attribution: "MeteoAlarm" };
    const yellow = readAlerts(entity("binary_sensor.meteoalarm_madrid", "on", { ...base, awareness_level: "2; yellow; Moderate" }), {
      entity: "binary_sensor.meteoalarm_madrid",
    });
    expect(yellow).toMatchObject([{ level: 1, title: "Rain", kind: "rain", source: "Meteoalarm", description: "Heavy rain" }]);
    expect(yellow[0].expires?.toISOString()).toBe("2026-11-05T23:59:00.000Z");

    const orange = readAlerts(entity("binary_sensor.meteoalarm_madrid", "on", { ...base, severity: "Severe" }), {
      entity: "binary_sensor.meteoalarm_madrid",
    });
    expect(orange[0].level).toBe(2);

    const green = entity("binary_sensor.meteoalarm_madrid", "on", { ...base, awareness_level: "1; green; Minor" });
    expect(readAlerts(green, { entity: green.entity_id })).toEqual([]);
  });

  it("ignores an inactive entity", () => {
    const off = entity("binary_sensor.meteoalarm_madrid", "off", { event: "Rain", severity: "Severe" });
    expect(readAlerts(off, { entity: off.entity_id })).toEqual([]);
  });

  it("reads NWS-style lists of alerts with CAP severity", () => {
    const sensor = entity("sensor.nws_alerts", "2", {
      alerts: [
        { Event: "Flood Watch", Severity: "Moderate", Headline: "Flood Watch issued", Expires: "2026-11-06T00:00:00Z" },
        { Event: "Tornado Warning", Severity: "Extreme" },
      ],
    });
    const alerts = readAlerts(sensor, { entity: sensor.entity_id });
    expect(alerts.map((a) => [a.title, a.level])).toEqual([["Flood Watch", 2], ["Tornado Warning", 4]]);
    expect(alerts[0].id).not.toBe(alerts[1].id);
  });

  it("derives Environment Canada levels from the sensor type", () => {
    const attrs = { alerts: [{ title: "Yellow Warning - Rainfall", date: "x" }] };
    const level = (id: string) => readAlerts(entity(id, "1", attrs), { entity: id })[0]?.level;
    expect(level("sensor.home_warnings")).toBe(3);
    expect(level("sensor.home_watches")).toBe(2);
    expect(level("sensor.home_statements")).toBe(1);
    expect(level("sensor.home_endings")).toBeUndefined();
  });

  it("supports custom attributes and level maps", () => {
    const sensor = entity("sensor.mine", "activo", { nivel: "fuerte", titulo: "Ola de calor", fin: "2026-11-07T00:00:00Z" });
    const [alert] = readAlerts(sensor, {
      entity: sensor.entity_id,
      adapter: "custom",
      level_attr: "nivel",
      event_attr: "titulo",
      expires_attr: "fin",
      levels: { leve: 1, fuerte: 3 },
    });
    expect(alert).toMatchObject({ level: 3, title: "Ola de calor", kind: "temperature" });
  });

  it("sorts by severity, drops expired alerts and respects min_level", () => {
    const states = {
      "sensor.a": entity("sensor.a", "2", {
        alerts: [
          { event: "Old", severity: "Extreme", expires: "2026-11-05T11:00:00Z" },
          { event: "Low", severity: "Minor" },
          { event: "High", severity: "Severe" },
        ],
      }),
    };
    expect(collectAlerts(states, { entities: ["sensor.a"] }, NOW).map((a) => a.title)).toEqual(["High", "Low"]);
    expect(collectAlerts(states, { entities: ["sensor.a"], min_level: 3 }, NOW).map((a) => a.title)).toEqual(["High"]);
    expect(collectAlerts(states, { entities: ["sensor.missing"] }, NOW)).toEqual([]);
  });
});

describe("alert helpers", () => {
  it("classifies the event", () => {
    expect(alertKind("Viento fuerte")).toBe("wind");
    expect(alertKind("Lluvia")).toBe("rain");
    expect(alertKind("Ola de calor")).toBe("temperature");
    expect(alertKind("Avalanche")).toBe("general");
  });

  it("formats the time window", () => {
    const fmt = createFormatters("en", { language: "en", time_format: "24", time_zone: "server" }, "UTC");
    const labels = { today: "Today", until: "Until" };
    const at = (iso: string) => new Date(iso);
    expect(formatWindow({ starts: at("2026-11-05T18:00:00Z"), expires: at("2026-11-05T23:59:00Z") }, NOW, fmt, labels)).toBe("Today 18:00 – 23:59");
    expect(formatWindow({ starts: at("2026-11-07T06:00:00Z"), expires: at("2026-11-08T09:00:00Z") }, NOW, fmt, labels)).toBe("Sat 06:00 – Sun 09:00");
    expect(formatWindow({ expires: at("2026-11-05T23:59:00Z") }, NOW, fmt, labels)).toBe("Until Today 23:59");
    expect(formatWindow({}, NOW, fmt, labels)).toBe("");
  });

  it("compacts defaults", () => {
    expect(compactAlerts({ entities: [] })).toBeUndefined();
    expect(compactAlerts({ entities: ["sensor.a"], min_level: 1, max_visible: 1 })).toEqual({ entities: ["sensor.a"] });
    expect(compactAlerts({ entities: ["sensor.a"], min_level: 3, max_visible: 2 })).toEqual({ entities: ["sensor.a"], min_level: 3, max_visible: 2 });
  });
});

describe("alerts config", () => {
  it("accepts entity ids and adapter objects", () => {
    expect(() => parseAlertsConfig({ entities: ["sensor.a", { entity: "sensor.b", adapter: "custom", levels: { x: 2 } }], min_level: 2, max_visible: 3 })).not.toThrow();
    expect(() => parseConfig({ entity: "weather.a", alerts: { entities: ["sensor.a"] } })).not.toThrow();
  });

  it.each([
    [{ entities: "sensor.a" }],
    [{ entities: [42] }],
    [{ entities: ["nodot"] }],
    [{ entities: [{ entity: "sensor.a", adapter: "foo" }] }],
    [{ entities: [{ entity: "sensor.a", levels: { x: 9 } }] }],
    [{ entities: [], min_level: 5 }],
    [{ entities: [], max_visible: 0 }],
  ])("rejects %j", (alerts) => {
    expect(() => parseConfig({ entity: "weather.a", alerts })).toThrow();
  });
});
