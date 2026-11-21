import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STREAM_RETRY_MS, ensureCameraStream } from "../src/utils/camera-stream";

describe("camera stream loader", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries after a failed attempt, at most once per retry window", async () => {
    const createCardElement = vi.fn();
    (window as unknown as { loadCardHelpers: unknown }).loadCardHelpers = async () => ({ createCardElement });

    const first = ensureCameraStream("camera.yard", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await first).toBe(false);
    expect(createCardElement).toHaveBeenCalledTimes(1);

    expect(await ensureCameraStream("camera.yard", 1000)).toBe(false); // inside the window: no new attempt
    expect(createCardElement).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(STREAM_RETRY_MS);
    const retry = ensureCameraStream("camera.yard", 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(createCardElement).toHaveBeenCalledTimes(2);
    customElements.define("ha-camera-stream", class extends HTMLElement {});
    expect(await retry).toBe(true);
  });
});
