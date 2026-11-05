import { describe, expect, it, vi } from "vitest";
import { isActionConfig, isInteractive, runAction } from "../src/utils/actions";
import type { HomeAssistant } from "../src/types/ha";

const hass = () => ({ callService: vi.fn() }) as unknown as HomeAssistant & { callService: ReturnType<typeof vi.fn> };

describe("actions", () => {
  it("validates action configs", () => {
    expect(isActionConfig({ action: "more-info" })).toBe(true);
    expect(isActionConfig({ action: "explode" })).toBe(false);
    expect(isActionConfig("more-info")).toBe(false);
    expect(isInteractive({ action: "none" })).toBe(false);
  });
  it("more-info uses the action entity, else the fallback", () => {
    const node = document.createElement("div");
    const seen: string[] = [];
    node.addEventListener("hass-more-info", (e) => seen.push((e as CustomEvent).detail.entityId));
    runAction(node, hass(), { action: "more-info", entity: "sensor.t" }, "weather.home");
    runAction(node, hass(), { action: "more-info" }, "weather.home");
    expect(seen).toEqual(["sensor.t", "weather.home"]);
  });
  it("calls services", () => {
    const h = hass();
    runAction(document.createElement("div"), h, { action: "perform-action", perform_action: "light.turn_on", data: { a: 1 }, target: { entity_id: "light.x" } }, "weather.home");
    expect(h.callService).toHaveBeenCalledWith("light", "turn_on", { a: 1 }, { entity_id: "light.x" });
  });
});
