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

  it("slides the old chart out and the new one in, then removes the old one", async () => {
    const finishers: (() => void)[] = [];
    const animate = vi.fn(() => ({
      playState: "finished",
      cancel: vi.fn(),
      addEventListener: (_: string, callback: () => void) => finishers.push(callback),
    }));
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
    try {
      const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
      const card = await mount(hass);
      const root = card.shadowRoot!;
      expect(animate).not.toHaveBeenCalled();
      const x = (call: number) => (animate.mock.calls[call] as unknown as [{ transform: string }[]])[0].map((k) => k.transform);

      const tabs = root.querySelectorAll<HTMLButtonElement>(".tabs button");
      tabs[1].click();
      await card.updateComplete;
      expect(animate).toHaveBeenCalledTimes(2);
      expect(x(0)).toEqual(["translateX(32px)", "translateX(0)"]); // new chart enters from the right
      expect(x(1)).toEqual(["translateX(0)", "translateX(-32px)"]); // old chart leaves to the left
      const ghost = root.querySelector(".scroller.ghost");
      expect(ghost?.getAttribute("aria-hidden")).toBe("true");
      expect(root.querySelectorAll(".scroller:not(.ghost)")).toHaveLength(1);
      expect(root.querySelector(".forecast")?.hasAttribute("data-sliding")).toBe(true);

      finishers.forEach((finish) => finish());
      expect(root.querySelector(".scroller.ghost")).toBeNull();
      expect(root.querySelector(".forecast")?.hasAttribute("data-sliding")).toBe(false);

      tabs[0].click();
      await card.updateComplete;
      expect(x(animate.mock.calls.length - 2)).toEqual(["translateX(-32px)", "translateX(0)"]);

      // Unrelated updates do not replay it.
      const calls = animate.mock.calls.length;
      card.hass = { ...hass, states: { ...hass.states, "weather.home": weather({ temperature: 20 }) as never } };
      await card.updateComplete;
      expect(animate).toHaveBeenCalledTimes(calls);
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
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

  it("opens the sensor history when tapping a metric with a custom sensor, and is inert otherwise", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    hass.states["sensor.h"] = { entity_id: "sensor.h", state: "55", attributes: { unit_of_measurement: "%" }, last_changed: "", last_updated: "" };
    const card = await mount(hass, { humidity_entity: "sensor.h" });
    const seen: string[] = [];
    card.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail.entityId));
    const metrics = [...card.shadowRoot!.querySelectorAll<HTMLElement>(".metric")];
    expect(metrics.filter((m) => m.classList.contains("interactive"))).toHaveLength(1);
    metrics.forEach((m) => m.click());
    expect(seen).toEqual(["sensor.h"]);
  });

  it("activates a metric with Enter or Space, not with other keys", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    hass.states["sensor.h"] = { entity_id: "sensor.h", state: "55", attributes: { unit_of_measurement: "%" }, last_changed: "", last_updated: "" };
    const card = await mount(hass, { humidity_entity: "sensor.h" });
    const seen: string[] = [];
    card.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail.entityId));
    const metric = card.shadowRoot!.querySelector<HTMLElement>(".metric.interactive")!;
    for (const key of ["a", "Enter", " "]) metric.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    expect(seen).toEqual(["sensor.h", "sensor.h"]);
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
    expect(root.querySelector(".alerts")?.hasAttribute("tabindex")).toBe(false);
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
    // One scroll area holds the pinned alert too, and is focusable only once there is something to scroll.
    const scroll = root.querySelector(".alerts") as HTMLElement;
    expect(scroll.contains(pinned())).toBe(true);
    expect(scroll.getAttribute("tabindex")).toBe("0");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    await card.updateComplete;
    expect(more().hasAttribute("data-open")).toBe(false);
    expect(pinned().querySelector(".alert")).toBe(first);
  });

  it("toggles from a click anywhere on an alert, once, unless text is being selected", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    addAlerts(hass, three());
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"] } });
    const root = card.shadowRoot!;
    const open = () => root.querySelector(".alert-toggle")!.getAttribute("aria-expanded");
    expect(root.querySelector(".alert")?.classList.contains("expandable")).toBe(true);

    (root.querySelector(".alert-title") as HTMLElement).click();
    await card.updateComplete;
    expect(open()).toBe("true");

    (root.querySelector(".alert-toggle") as HTMLButtonElement).click(); // button bubbles to the row: one toggle
    await card.updateComplete;
    expect(open()).toBe("false");

    const selection = vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Heavy" } as Selection);
    (root.querySelector(".alert-title") as HTMLElement).click();
    await card.updateComplete;
    expect(open()).toBe("false");
    selection.mockRestore();
  });

  it("does not look clickable when there is nothing to expand", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: nextDays() });
    addAlerts(hass, [{ event: "Frost", severity: "Minor", expires: future(9) }]);
    const card = await mount(hass, { alerts: { entities: ["sensor.nws_alerts"] } });
    expect(card.shadowRoot!.querySelector(".alert")?.classList.contains("expandable")).toBe(false);
    expect(card.shadowRoot!.querySelector(".alert-toggle")).toBeNull();
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

const image = "/api/camera_proxy/camera.yard?token=t";
const withCamera = () => {
  const { hass } = makeHass({ hourly: nextHours(), daily: [] });
  (hass.states as Record<string, unknown>)["camera.yard"] = { entity_id: "camera.yard", state: "idle", last_changed: "", last_updated: "", attributes: { friendly_name: "Yard", entity_picture: image } };
  return hass;
};

describe("camera", () => {
  const tabs = (card: HTMLElement) => [...card.shadowRoot!.querySelectorAll(".tabs button")].map((b) => b.textContent!.trim());

  it("draws nothing camera-related without a camera", async () => {
    const { hass } = makeHass({ hourly: nextHours(), daily: [] });
    const card = await mount(hass);
    expect(card.shadowRoot!.querySelector(".cam")).toBeNull();
    expect(tabs(card)).not.toContain("Camera");
  });

  it("adds a Camera tab (layout tab) that shows the image", async () => {
    const hass = withCamera();
    const card = await mount(hass, { camera_entity: "camera.yard" });
    expect(tabs(card)).toContain("Camera");
    expect(card.shadowRoot!.querySelector(".cam")).toBeNull();
    [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => b.textContent!.includes("Camera"))!.click();
    await card.updateComplete;
    const img = card.shadowRoot!.querySelector<HTMLImageElement>(".cam img");
    expect(img?.src).toContain(image);
  });

  it("shows an expandable strip (layout strip) without an extra tab", async () => {
    const hass = withCamera();
    const card = await mount(hass, { camera_entity: "camera.yard", camera_layout: "strip" });
    expect(tabs(card)).not.toContain("Camera");
    const chevron = () => card.shadowRoot!.querySelector<HTMLButtonElement>(".cam-chevron")!;
    expect(chevron().getAttribute("aria-expanded")).toBe("false");
    chevron().click();
    await card.updateComplete;
    expect(chevron().getAttribute("aria-expanded")).toBe("true");
  });
});

describe("camera tap", () => {
  const open = async (config: Record<string, unknown>) => {
    const hass = withCamera();
    const card = await mount(hass, { camera_entity: "camera.yard", ...config });
    [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => b.textContent!.includes("Camera"))!.click();
    await card.updateComplete;
    return card;
  };

  it("opens the entity live view by default", async () => {
    const card = await open({});
    const seen: unknown[] = [];
    card.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail));
    card.shadowRoot!.querySelector<HTMLButtonElement>(".cam-panel")!.click();
    expect(seen).toEqual([{ entityId: "camera.yard" }]);
  });

  it("is not a button when the tap action is none", async () => {
    const card = await open({ camera_tap_action: { action: "none" } });
    expect(card.shadowRoot!.querySelector("button.cam-panel")).toBeNull();
  });

  it("strip: tap expands, then opens; the chevron collapses", async () => {
    const hass = withCamera();
    const card = await mount(hass, { camera_entity: "camera.yard", camera_layout: "strip" });
    const spy = vi.fn();
    card.addEventListener("hass-more-info", spy);
    const q = (s: string) => card.shadowRoot!.querySelector<HTMLButtonElement>(s)!;
    q(".cam-hit").click();
    await card.updateComplete;
    expect(spy).not.toHaveBeenCalled();
    expect(q(".cam-chevron").getAttribute("aria-expanded")).toBe("true");
    q(".cam-hit").click();
    expect(spy).toHaveBeenCalledOnce();
    q(".cam-chevron").click();
    await card.updateComplete;
    expect(q(".cam-chevron").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("camera live", () => {
  const streamHass = (features: number) => {
    const hass = withCamera();
    const state = (hass.states as Record<string, { attributes: Record<string, unknown> }>)["camera.yard"];
    state.attributes.supported_features = features;
    return hass;
  };
  const flush = async (card: Card) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card.updateComplete;
  };

  it("plays the HA stream player when the camera supports streaming", async () => {
    if (!customElements.get("ha-camera-stream")) customElements.define("ha-camera-stream", class extends HTMLElement {});
    const card = await mount(streamHass(2), { camera_entity: "camera.yard" });
    [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => b.textContent!.includes("Camera"))!.click();
    await flush(card);
    expect(card.shadowRoot!.querySelector(".cam-live ha-camera-stream")).not.toBeNull();
    expect(card.shadowRoot!.querySelector(".cam img")).toBeNull();
  });

  it("keeps the still image when the camera has no stream support", async () => {
    for (const features of [0, 1]) {
      const card = await mount(streamHass(features), { camera_entity: "camera.yard" });
      [...card.shadowRoot!.querySelectorAll<HTMLButtonElement>(".tabs button")].find((b) => b.textContent!.includes("Camera"))!.click();
      await flush(card);
      expect(card.shadowRoot!.querySelector(".cam img")).not.toBeNull();
      expect(card.shadowRoot!.querySelector("ha-camera-stream")).toBeNull();
      document.body.innerHTML = "";
    }
  });
});

describe("camera as default view", () => {
  it("opens on the camera tab when it exists, and falls back to the forecast when it does not", async () => {
    const withIt = await mount(withCamera(), { camera_entity: "camera.yard", default_view: "camera" });
    expect(withIt.shadowRoot!.querySelector(".cam-panel")).not.toBeNull();
    document.body.innerHTML = "";
    const { hass } = makeHass({ hourly: nextHours(), daily: [] });
    const without = await mount(hass, { default_view: "camera" });
    expect(without.shadowRoot!.querySelector(".cam-panel")).toBeNull();
    expect(without.shadowRoot!.querySelector(".scroller")).not.toBeNull();
  });
});

describe("preview following the editor", () => {
  const announce = (index: number, signature: string) =>
    window.dispatchEvent(new CustomEvent("ha-forecast-card:preview-location", { detail: { index, signature } }));
  const shown = (card: Card) => (card as unknown as { _config: { entity: string } })._config.entity;
  /** The card next to the editor: inside the edit dialog, with `preview` set by Home Assistant. */
  const previewCard = () => {
    const card = document.createElement("ha-forecast-card") as Card & { preview?: boolean };
    card.preview = true;
    const dialog = document.createElement("ha-dialog");
    document.body.append(dialog);
    dialog.attachShadow({ mode: "open" }).append(card);
    return card;
  };

  it("shows the place the editor selected, and ignores other cards' places", async () => {
    const card = previewCard();
    card.setConfig({ locations: [{ entity: "weather.a" }, { entity: "weather.b" }] });
    announce(1, "weather.a|weather.b");
    expect(shown(card)).toBe("weather.b");
    announce(0, "weather.x|weather.y");
    expect(shown(card)).toBe("weather.b");
    card.remove();
  });

  it("applies a selection announced before its config arrives (reorder)", () => {
    const card = previewCard();
    card.setConfig({ locations: [{ entity: "weather.a" }, { entity: "weather.b" }] });
    announce(0, "weather.b|weather.a");
    card.setConfig({ locations: [{ entity: "weather.b" }, { entity: "weather.a" }] });
    expect(shown(card)).toBe("weather.b");
    card.remove();
  });

  it("leaves dashboard cards on their own place, also in edit mode (where HA marks them all as preview)", () => {
    const card = document.createElement("ha-forecast-card") as Card & { preview?: boolean };
    card.preview = true;
    document.body.append(card);
    card.setConfig({ locations: [{ entity: "weather.a" }, { entity: "weather.b" }] });
    announce(1, "weather.a|weather.b");
    expect(shown(card)).toBe("weather.a");
    card.remove();
  });
});
