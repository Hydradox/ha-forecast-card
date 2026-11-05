import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/ha-forecast-card";
import type { HomeAssistant } from "../src/types/ha";


type Card = HTMLElement & { hass?: HomeAssistant; setConfig(c: unknown): void; updateComplete: Promise<boolean> };

const weather = (attributes: Record<string, unknown> = {}) => ({
  entity_id: "weather.home",
  state: "partlycloudy",
  last_changed: "",
  last_updated: "",
  attributes: {
    friendly_name: "Home",
    temperature: 18.1,
    temperature_unit: "°C",
    humidity: 67,
    wind_speed: 10,
    wind_speed_unit: "km/h",
    wind_bearing: 112,
    uv_index: 1.7,
    supported_features: 3,
    ...attributes,
  },
});

function makeHass(forecasts: { hourly: unknown[]; daily: unknown[] }, attrs = {}) {
  const subscribe = vi.fn(async (cb: (e: unknown) => void, msg: { forecast_type: "hourly" | "daily" }) => {
    cb({ type: msg.forecast_type, forecast: forecasts[msg.forecast_type] });
    return () => undefined;
  });
  const hass = {
    states: { "weather.home": weather(attrs) },
    config: { unit_system: { temperature: "°C", precipitation: "mm", wind_speed: "km/h" }, time_zone: "UTC" },
    language: "en",
    locale: { language: "en", time_format: "24", time_zone: "server" },
    connection: { subscribeMessage: subscribe },
    callService: vi.fn(),
  } as unknown as HomeAssistant;
  return { hass, subscribe };
}

async function mount(hass: HomeAssistant, config: Record<string, unknown> = {}) {
  const card = document.createElement("ha-forecast-card") as Card;
  card.setConfig({ type: "custom:ha-forecast-card", entity: "weather.home", ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await Promise.resolve();
  await card.updateComplete;
  return card;
}

afterEach(() => {
  document.body.innerHTML = "";
});

const nextHours = () => {
  const start = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  return [1, 2, 3].map((i) => ({
    datetime: new Date(start + i * 3_600_000).toISOString(),
    temperature: 15 + i,
    condition: "rainy",
    precipitation: i === 2 ? 0.8 : 0,
  }));
};
const nextDays = () => {
  const start = Date.now();
  return [0, 1, 2].map((i) => ({
    datetime: new Date(start + i * 86_400_000).toISOString(),
    temperature: 19 - i,
    templow: 11 - i,
    condition: "sunny",
  }));
};

describe("ha-forecast-card", () => {
  it("subscribes to both forecasts and renders header, tabs, chart and metrics", async () => {
    const { hass, subscribe } = makeHass({ hourly: nextHours(), daily: nextDays() });
    const card = await mount(hass);
    const root = card.shadowRoot!;

    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(root.querySelector(".state")?.textContent).toBe("partlycloudy");
    expect(root.querySelector(".temperature")?.textContent).toContain("18.1");
    expect(root.querySelector(".range")?.textContent).toContain("19°");
    expect(root.querySelectorAll(".tabs button")).toHaveLength(2);
    expect(root.querySelectorAll(".row.labels span")).toHaveLength(4); // Now + 3 hours
    expect(root.querySelectorAll("svg polyline.line")).toHaveLength(1);
    expect(root.querySelectorAll(".metric")).toHaveLength(3);
    expect(root.querySelector(".metric .level")?.textContent).toBe("Humid");
    expect(root.querySelectorAll(".bar")).toHaveLength(1);
  });

  it("switches to the daily view with max and min lines", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    const card = await mount(hass);
    const root = card.shadowRoot!;
    (root.querySelectorAll(".tabs button")[1] as HTMLButtonElement).click();
    await card.updateComplete;
    expect(root.querySelector(".row.labels span")?.textContent).toBe("Today");
    expect(root.querySelectorAll("svg polyline.line-min")).toHaveLength(1);
  });

  it("hides tabs and the strip when the integration only supports daily and has no attributes", async () => {
    const { hass } = makeHass({ hourly: [], daily: nextDays() }, { supported_features: 1, humidity: undefined, wind_speed: undefined, uv_index: undefined });
    const card = await mount(hass);
    const root = card.shadowRoot!;
    expect(root.querySelector(".tabs")).toBeNull();
    expect(root.querySelector(".attributes")).toBeNull();
    expect(root.querySelectorAll(".row.labels span").length).toBe(3);
  });

  it("opens the temperature sensor history on temperature tap, without triggering the card action", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    const card = await mount(hass, { temperature_entity: "sensor.t" });
    hass.states["sensor.t"] = { entity_id: "sensor.t", state: "20", attributes: { unit_of_measurement: "°C" }, last_changed: "", last_updated: "" };
    card.hass = { ...hass };
    await card.updateComplete;
    const seen: string[] = [];
    card.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail.entityId));
    (card.shadowRoot!.querySelector(".temperature") as HTMLElement).click();
    expect(seen).toEqual(["sensor.t"]);
  });

  it("honours show_name: false", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    const card = await mount(hass, { show_name: false });
    expect(card.shadowRoot!.querySelector(".secondary")).toBeNull();
  });
});

describe("alerts", () => {
  const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const addAlerts = (hass: HomeAssistant, alerts: Record<string, unknown>[]) => {
    hass.states["sensor.nws_alerts"] = {
      entity_id: "sensor.nws_alerts",
      state: String(alerts.length),
      attributes: { alerts },
      last_changed: "",
      last_updated: "",
    };
  };
  const three = () => [
    { event: "Rain", severity: "Moderate", description: "Heavy rain", expires: future(5) },
    { event: "Wind", severity: "Severe", description: "Gusts up to 90 km/h", expires: future(8) },
    { event: "Frost", severity: "Minor", expires: future(9) },
  ];

  it("renders nothing without alerts", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"] } });
    expect(card.shadowRoot!.querySelector(".alerts")).toBeNull();
  });

  it("pins the most severe alert and slides the rest open without moving it", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    addAlerts(hass, three());
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"] } });
    const root = card.shadowRoot!;

    const pinned = () => root.querySelector(".alerts-pinned")!;
    const more = () => root.querySelector(".alerts-more")!.closest(".collapse") as HTMLElement;
    expect(pinned().querySelectorAll(".alert")).toHaveLength(1);
    expect(pinned().querySelector(".alert-title")?.textContent).toContain("Wind");
    expect(pinned().querySelector(".alert-chip")?.textContent).toBe("Red");
    expect(more().hasAttribute("data-open")).toBe(false);
    expect(more().hasAttribute("inert")).toBe(true);
    const toggle = root.querySelector(".alert-toggle") as HTMLButtonElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("+2");
    const first = pinned().querySelector(".alert");

    toggle.click();
    await card.updateComplete;
    // The same element stays in place: the count and the rest open below it.
    expect(pinned().querySelector(".alert")).toBe(first);
    expect(root.querySelector(".alert-toggle")).toBe(toggle);
    expect(more().hasAttribute("data-open")).toBe(true);
    expect(more().hasAttribute("inert")).toBe(false);
    expect(root.querySelectorAll(".alert")).toHaveLength(3);
    expect(root.querySelector(".alerts-count")).toBeNull();
    expect(root.querySelector(".alert-text")?.textContent).toBe("Gusts up to 90 km/h");
    expect(root.querySelector(".alert-list")?.getAttribute("tabindex")).toBe("0");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    await card.updateComplete;
    expect(more().hasAttribute("data-open")).toBe(false);
    expect(pinned().querySelector(".alert")).toBe(first);
  });

  it("honours max_visible and min_level", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    addAlerts(hass, three());
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"], max_visible: 2, min_level: 2 } });
    expect(card.shadowRoot!.querySelectorAll(".alerts-pinned .alert")).toHaveLength(2);
    expect(card.shadowRoot!.querySelector(".alerts-more")).toBeNull();
    expect(card.shadowRoot!.querySelector(".alert-toggle")?.textContent).not.toContain("+");
  });

  it("does not trigger the card action when interacting with alerts", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    addAlerts(hass, three());
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"] } });
    const seen: string[] = [];
    card.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail.entityId));
    (card.shadowRoot!.querySelector(".alert-toggle") as HTMLButtonElement).click();
    expect(seen).toEqual([]);
  });

  it("re-renders when an alert entity changes", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    addAlerts(hass, three());
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"] } });
    // HA replaces `hass` and the changed entity object; mutating the old one would hide the change.
    const next = { ...hass, states: { ...hass.states } } as HomeAssistant;
    addAlerts(next, []);
    card.hass = next;
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector(".alerts")).toBeNull();
  });
});

describe("drag to scroll", () => {
  it("scrolls the chart when dragging with the mouse, but not on a plain click", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    const card = await mount(hass);
    const scroller = card.shadowRoot!.querySelector(".scroller") as HTMLElement;
    const pointer = (type: string, x: number) =>
      scroller.dispatchEvent(new PointerEvent(type, { pointerType: "mouse", button: 0, clientX: x, bubbles: true }));

    pointer("pointerdown", 200);
    pointer("pointermove", 198); // below threshold
    expect(scroller.hasAttribute("data-dragging")).toBe(false);
    pointer("pointermove", 120);
    expect(scroller.hasAttribute("data-dragging")).toBe(true);
    expect(scroller.scrollLeft).toBe(80);
    pointer("pointerup", 120);
    expect(scroller.hasAttribute("data-dragging")).toBe(false);
  });
});
