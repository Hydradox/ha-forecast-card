import { afterEach, describe, expect, it } from "vitest";
import "../src/editor/ha-forecast-card-editor";
import type { HomeAssistant } from "../src/types/ha";

type Editor = HTMLElement & { hass?: HomeAssistant; setConfig(c: Record<string, unknown>): void; updateComplete: Promise<boolean> };
type Item = { type?: string; name: string; flatten?: boolean; schema?: Item[] };

const hass = { language: "en", config: { unit_system: { temperature: "°C" } } } as unknown as HomeAssistant;

async function mount(config: Record<string, unknown>) {
  const editor = document.createElement("ha-forecast-card-editor") as Editor;
  editor.hass = hass;
  editor.setConfig(config);
  document.body.append(editor);
  await editor.updateComplete;
  return editor;
}
const form = (editor: Editor) => editor.shadowRoot!.querySelector("ha-form") as HTMLElement & { schema: Item[]; data: Record<string, unknown> };

afterEach(() => (document.body.innerHTML = ""));

describe("editor", () => {
  it("keeps section fields flat so they land at the top level of the config", async () => {
    const { schema } = form(await mount({ entity: "weather.a" }));
    // `alerts` is the one nested section: the card reads it as `alerts.entities`, `alerts.min_level`...
    const sections = schema.filter((item) => item.type === "expandable" && item.name !== "alerts");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) expect(section.flatten).toBe(true);
  });

  it("edits alert entity ids and keeps YAML-only (custom adapter) entries", async () => {
    const custom = { entity: "sensor.mine", adapter: "custom", level_attr: "nivel" };
    const editor = await mount({ entity: "weather.a", alerts: { entities: ["binary_sensor.meteoalarm", custom], min_level: 2 } });
    const data = form(editor).data as { alerts: { entities: unknown[]; min_level: number; max_visible: number } };
    expect(data.alerts).toEqual({ entities: ["binary_sensor.meteoalarm"], min_level: 2, max_visible: 1 });

    let emitted: Record<string, unknown> | undefined;
    editor.addEventListener("config-changed", (e) => (emitted = (e as CustomEvent).detail.config));
    const change = (alerts: unknown) =>
      form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...form(editor).data, alerts } } }));

    change({ ...data.alerts, entities: ["binary_sensor.meteoalarm", "sensor.nws_alerts"] });
    expect(emitted).toEqual({
      entity: "weather.a",
      alerts: { entities: ["binary_sensor.meteoalarm", "sensor.nws_alerts", custom], min_level: 2 },
    });

    change({ entities: [], min_level: 1, max_visible: 1 });
    expect(emitted).toEqual({ entity: "weather.a", alerts: { entities: [custom] } });
  });

  it("drops the alerts block when it only holds defaults", async () => {
    const editor = await mount({ entity: "weather.a" });
    let emitted: Record<string, unknown> | undefined;
    editor.addEventListener("config-changed", (e) => (emitted = (e as CustomEvent).detail.config));
    form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...form(editor).data, hours_to_show: 12 } } }));
    expect(emitted).toEqual({ entity: "weather.a", hours_to_show: 12 });
  });

  it("shows unit-aware defaults for thresholds", async () => {
    const data = form(await mount({ entity: "weather.a" })).data;
    expect(data).toMatchObject({ cold_threshold: 0, hot_threshold: 35, show_name: true });
  });

  it("recovers configs saved with nested section_* objects, and emits compact config", async () => {
    const editor = await mount({ entity: "weather.a", section_thresholds: { hot_threshold: 15 }, section_sensors: {} });
    expect(form(editor).data.hot_threshold).toBe(15);

    let emitted: Record<string, unknown> | undefined;
    editor.addEventListener("config-changed", (e) => (emitted = (e as CustomEvent).detail.config));
    form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...form(editor).data, hours_to_show: 12 } } }));
    expect(emitted).toEqual({ entity: "weather.a", hours_to_show: 12, hot_threshold: 15 });
  });

  it("does not save hot <= cold: shows an error and keeps the last valid config", async () => {
    const editor = await mount({ entity: "weather.a", hot_threshold: 30 });
    const events: unknown[] = [];
    editor.addEventListener("config-changed", (e) => events.push((e as CustomEvent).detail.config));
    const change = (value: Record<string, unknown>) =>
      form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value } }));

    change({ ...form(editor).data, cold_threshold: 30 }); // equal → invalid
    await editor.updateComplete;
    expect(events).toHaveLength(0);
    expect(editor.shadowRoot!.querySelector("ha-alert")?.textContent).toContain("higher");
    expect(form(editor).data.cold_threshold).toBe(30); // the typed value stays visible

    change({ ...form(editor).data, cold_threshold: 5 }); // fixed → saved
    await editor.updateComplete;
    expect(events).toEqual([{ entity: "weather.a", cold_threshold: 5, hot_threshold: 30 }]);
    expect(editor.shadowRoot!.querySelector("ha-alert")).toBeNull();
  });

  it("lists every festivity with its defaults and saves only the changes", async () => {
    const editor = await mount({ entity: "weather.a", festivities: { halloween: { start: "10-20" } } });
    const data = form(editor).data as { festivities: Record<string, Record<string, unknown>> };
    expect(data.festivities.halloween).toEqual({ enabled: true, start: "10-20", end: "11-01" });
    expect(data.festivities.fallas.enabled).toBe(false); // off by default
    expect(data.festivities.easter).toEqual({ enabled: true, start_offset: -7, end_offset: 1 });

    let emitted: Record<string, unknown> | undefined;
    editor.addEventListener("config-changed", (e) => (emitted = (e as CustomEvent).detail.config));
    const festivities = { ...data.festivities, christmas: { enabled: false, start: "12-01", end: "12-26" } };
    form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...form(editor).data, festivities, weather_effects: false } } }));
    expect(emitted).toEqual({
      entity: "weather.a",
      weather_effects: false,
      festivities: { halloween: { start: "10-20" }, christmas: { enabled: false } },
    });
  });

  it("does not save impossible festivity dates", async () => {
    const editor = await mount({ entity: "weather.a" });
    let emitted: unknown;
    editor.addEventListener("config-changed", (e) => (emitted = e));
    const data = form(editor).data as { festivities: Record<string, unknown> };
    form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...form(editor).data, festivities: { ...data.festivities, fallas: { enabled: true, start: "02-30", end: "03-19" } } } } }));
    await editor.updateComplete;
    expect(emitted).toBeUndefined();
    expect(editor.shadowRoot!.querySelector("ha-alert")).not.toBeNull();
  });
});

describe("editor with several locations", () => {
  const emitted = (editor: Editor) => {
    const out: { config?: Record<string, unknown> } = {};
    editor.addEventListener("config-changed", (e) => (out.config = (e as CustomEvent).detail.config));
    return out;
  };
  const click = (editor: Editor, text: RegExp) =>
    Array.from(editor.shadowRoot!.querySelectorAll("button"))
      .find((button) => text.test(button.textContent ?? ""))!
      .click();

  it("turns a flat config into a list when a location is added", async () => {
    const editor = await mount({ type: "custom:ha-forecast-card", entity: "weather.a", days_to_show: 3, language: "es" });
    const out = emitted(editor);
    click(editor, /^\+/); // language is "es": match the plus sign
    expect(out.config).toEqual({
      type: "custom:ha-forecast-card",
      language: "es",
      locations: [{ entity: "weather.a", days_to_show: 3 }, { entity: "" }],
    });
  });

  it("edits the selected location only, and hides show_name (the name line is the selector)", async () => {
    const editor = await mount({
      type: "x",
      locations: [{ entity: "weather.a" }, { entity: "weather.b", days_to_show: 2 }],
    });
    const out = emitted(editor);
    click(editor, /weather\.b/);
    await editor.updateComplete;
    expect(form(editor).data.entity).toBe("weather.b");
    const header = form(editor).schema.find((item) => item.name === "section_header")!;
    expect(header.schema!.map((item) => item.name)).toEqual(["name"]);

    form(editor).dispatchEvent(new CustomEvent("value-changed", { detail: { value: { ...form(editor).data, name: "Beach" } } }));
    expect(out.config).toEqual({ type: "x", locations: [{ entity: "weather.a" }, { entity: "weather.b", days_to_show: 2, name: "Beach" }] });
  });

  it("reorders a location with the keyboard on its handle", async () => {
    const editor = await mount({ type: "x", locations: [{ entity: "weather.a" }, { entity: "weather.b" }, { entity: "weather.c" }] });
    const out = emitted(editor);
    const handle = editor.shadowRoot!.querySelector<HTMLElement>('.chip[data-index="1"] button')!;
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(out.config).toEqual({ type: "x", locations: [{ entity: "weather.b" }, { entity: "weather.a" }, { entity: "weather.c" }] });
  });

  it("can still select another location after reordering", async () => {
    const editor = await mount({ type: "x", locations: [{ entity: "weather.a" }, { entity: "weather.b" }, { entity: "weather.c" }] });
    editor.shadowRoot!.querySelector<HTMLElement>('.chip[data-index="0"] button')!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    editor.setConfig({ type: "x", locations: [{ entity: "weather.b" }, { entity: "weather.a" }, { entity: "weather.c" }] });
    await editor.updateComplete;
    click(editor, /weather\.c/);
    await editor.updateComplete;
    expect(form(editor).data.entity).toBe("weather.c");
  });

  it("shows no grip with a single location", async () => {
    const editor = await mount({ type: "x", locations: [{ entity: "weather.a" }] });
    expect(editor.shadowRoot!.querySelector(".grip")).toBeNull();
  });

  it("goes back to a flat config when one location is left", async () => {
    const editor = await mount({ type: "x", locations: [{ entity: "weather.a" }, { entity: "weather.b" }] });
    const out = emitted(editor);
    click(editor, /Remove location/);
    expect(out.config).toEqual({ type: "x", entity: "weather.b" }); // the selected one (the first) is removed
  });
});

