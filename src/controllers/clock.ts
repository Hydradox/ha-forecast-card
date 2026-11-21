import type { ReactiveController, ReactiveControllerHost } from "lit";

/** Every UTC offset is a multiple of 15 minutes, so ticking on the quarter hour also hits local hours and midnight. */
export const CLOCK_STEP_MS = 15 * 60_000;

/** Delay until the next multiple of `step` after `now` (never zero, so a tick does not fire twice). */
export function untilNextTick(now: number, step = CLOCK_STEP_MS): number {
  return step - (now % step) || step;
}

/**
 * Re-renders the host when the clock moves on, so time-based content ("Now" column, today's range, expired
 * alerts, the festivity of the day, the hourly history fetch) does not wait for an entity to change. Ticks on
 * the quarter hour, and skips ticks while the page is hidden: becoming visible again re-renders at once.
 */
export class ClockController implements ReactiveController {
  private timer?: ReturnType<typeof setTimeout>;
  private connected = false;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    this.connected = true;
    document.addEventListener("visibilitychange", this.onVisibility);
    this.schedule();
  }

  hostDisconnected(): void {
    this.connected = false;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clear();
  }

  private schedule(): void {
    this.clear();
    if (!this.connected || document.hidden) return;
    this.timer = setTimeout(() => {
      this.host.requestUpdate();
      this.schedule();
    }, untilNextTick(Date.now()));
  }

  private clear(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private onVisibility = (): void => {
    if (document.hidden) return this.clear();
    this.host.requestUpdate(); // time may have moved on while hidden
    this.schedule();
  };
}
