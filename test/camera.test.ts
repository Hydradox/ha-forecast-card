import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config";
import { cameraFrame, hasCamera, withStamp } from "../src/utils/camera";

const state = (attributes: Record<string, unknown>, value = "idle") => ({
  entity_id: "camera.yard",
  state: value,
  attributes,
  last_changed: "",
  last_updated: "",
});

describe("camera utils", () => {
  it("only exists with an entity or an image", () => {
    expect(hasCamera({})).toBe(false);
    expect(hasCamera({ camera_entity: "camera.yard" })).toBe(true);
  });
  it("adds the cache stamp to the query, keeping the fragment", () => {
    expect(withStamp("https://x.test/a.jpg", 5)).toBe("https://x.test/a.jpg?_hfc=5");
    expect(withStamp("/api/camera_proxy/camera.yard?token=t", 5)).toBe("/api/camera_proxy/camera.yard?token=t&_hfc=5");
    expect(withStamp("https://x.test/a.jpg#f", 5)).toBe("https://x.test/a.jpg?_hfc=5#f");
  });
  it("uses the entity picture, and nothing when unavailable", () => {
    const entity = state({ entity_picture: "/api/camera_proxy/camera.yard?token=t", friendly_name: "Yard" });
    const config = { camera_entity: "camera.yard" };
    expect(cameraFrame(config, entity, 1)).toEqual({ url: "/api/camera_proxy/camera.yard?token=t&_hfc=1", name: "Yard", entity: "camera.yard" });
    expect(cameraFrame(config, state({ entity_picture: "/x" }, "unavailable"), 1).url).toBeUndefined();
    expect(cameraFrame({ camera_entity: "camera.yard" }, undefined, 1).url).toBeUndefined();
  });
  it("uses camera_name over the friendly name and resolves server paths", () => {
    const entity = state({ entity_picture: "/api/p", friendly_name: "Yard" });
    const frame = cameraFrame({ camera_entity: "camera.yard", camera_name: "Garden" }, entity, 2, (p) => `https://ha.test${p}`);
    expect(frame.name).toBe("Garden");
    expect(frame.url).toBe("https://ha.test/api/p?_hfc=2");
  });
});

describe("camera config", () => {
  const base = { type: "custom:ha-forecast-card", entity: "weather.home" };
  it("defaults to the tab layout, 5 min refresh", () => {
    const config = parseConfig({ ...base, camera_entity: "camera.yard" });
    expect(config.camera_layout).toBe("tab");
    expect(config.camera_refresh).toBe(300);
  });
  it("rejects bad values", () => {
    expect(() => parseConfig({ ...base, camera_entity: "light.x" })).toThrow(/camera_entity/);
    expect(() => parseConfig({ ...base, camera_layout: "grid" })).toThrow(/camera_layout/);
    expect(() => parseConfig({ ...base, camera_refresh: 0 })).toThrow(/camera_refresh/);
  });
});

describe("camera stream", () => {
  it("detects stream support from the STREAM feature bit", async () => {
    const { supportsStream } = await import("../src/utils/camera-stream");
    expect(supportsStream({ supported_features: 2 })).toBe(true);
    expect(supportsStream({ supported_features: 3 })).toBe(true);
    expect(supportsStream({ supported_features: 1 })).toBe(false);
    expect(supportsStream(undefined)).toBe(false);
  });
});

describe("default_view camera", () => {
  it("accepts camera", () => {
    expect(parseConfig({ type: "x", entity: "weather.home", default_view: "camera" }).default_view).toBe("camera");
  });
});
