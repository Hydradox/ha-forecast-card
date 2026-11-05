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
