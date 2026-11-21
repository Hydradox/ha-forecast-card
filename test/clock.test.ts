import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { CLOCK_STEP_MS, ClockController, untilNextTick } from "../src/controllers/clock";

function host() {
  const controllers: ReactiveController[] = [];
  const requestUpdate = vi.fn();
  const element = { addController: (c: ReactiveController) => controllers.push(c), requestUpdate } as unknown as ReactiveControllerHost;
  return { element, requestUpdate, connect: () => controllers.forEach((c) => c.hostConnected?.()), disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()) };
}

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T10:07:30Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it("waits until the next quarter hour, never zero", () => {
    expect(untilNextTick(Date.parse("2026-11-21T10:07:30Z"))).toBe(7.5 * 60_000);
    expect(untilNextTick(Date.parse("2026-11-21T10:15:00Z"))).toBe(CLOCK_STEP_MS);
  });

  it("re-renders the host on every quarter hour while connected", () => {
    const { element, requestUpdate, connect, disconnect } = host();
    new ClockController(element);
    connect();
    vi.advanceTimersByTime(7.5 * 60_000 - 1);
    expect(requestUpdate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(requestUpdate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(CLOCK_STEP_MS);
    expect(requestUpdate).toHaveBeenCalledTimes(2);
    disconnect();
    vi.advanceTimersByTime(CLOCK_STEP_MS * 4);
    expect(requestUpdate).toHaveBeenCalledTimes(2);
  });

  it("stops while the page is hidden and catches up when it shows again", () => {
    const { element, requestUpdate, connect, disconnect } = host();
    new ClockController(element);
    connect();
    setHidden(true);
    vi.advanceTimersByTime(CLOCK_STEP_MS * 3);
    expect(requestUpdate).not.toHaveBeenCalled();
    setHidden(false);
    expect(requestUpdate).toHaveBeenCalledTimes(1);
    disconnect();
  });
});
