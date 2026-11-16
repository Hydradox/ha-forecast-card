import type { ReactiveController, ReactiveControllerHost } from "lit";

/**
 * Re-renders the host every few seconds while the camera is on screen, so the still image is reloaded.
 * `stamp` only changes on a tick, so unrelated renders keep the same image URL (no refetch).
 */
export class CameraRefresh implements ReactiveController {
  stamp = Date.now();
  private timer?: ReturnType<typeof setInterval>;
  private seconds = 0;
  private active = false;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  /** Idempotent: restarts the timer only when something changed. */
  configure(active: boolean, seconds: number): void {
    if (active === this.active && seconds === this.seconds) return;
    this.active = active;
    this.seconds = seconds;
    this.restart();
  }

  hostConnected(): void {
    this.restart();
  }

  hostDisconnected(): void {
    this.stop();
  }

  private restart(): void {
    this.stop();
    if (!this.active || this.seconds <= 0) return;
    this.timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      this.stamp = Date.now();
      this.host.requestUpdate();
    }, this.seconds * 1000);
  }

  private stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
}
