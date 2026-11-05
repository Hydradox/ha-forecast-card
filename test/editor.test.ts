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
    const sections = schema.filter((item) => item.type === "expandable");
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) expect(section.flatten).toBe(true);
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
    const colors = form(editor).schema.find((item) => item.name === "section_thresholds") as Item & { expanded?: boolean };
    expect(colors.expanded).toBe(true);

    change({ ...form(editor).data, cold_threshold: 5 }); // fixed → saved
    await editor.updateComplete;
    expect(events).toEqual([{ entity: "weather.a", cold_threshold: 5, hot_threshold: 30 }]);
    expect(editor.shadowRoot!.querySelector("ha-alert")).toBeNull();
  });
});
