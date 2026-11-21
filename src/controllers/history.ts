import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { HomeAssistant } from "../types/ha";
import type { HistoryState } from "../utils/history";

const HOUR_MS = 3_600_000;

/**
 * Loads the recorder history of a few entities (`history/history_during_period`) for the past hours.
 * One fetch per (entities, hours, clock hour): the card re-renders on every sensor update, so crossing
 * into a new hour is noticed by `configure` without any timer.
 */
export class HistoryController implements ReactiveController {
  /** States per entity id, oldest first. */
  data: Record<string, HistoryState[]> | undefined;

  private key: string | undefined;
  private ids: string | undefined;
  private connected = false;

  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected(): void {
    this.connected = true;
  }

  hostDisconnected(): void {
    this.connected = false;
    this.key = undefined; // refetch on reconnect: the data may be stale by then
  }

  /** Call from `willUpdate`. Cheap: only fetches when entities, hours or the clock hour change. */
  configure(hass: HomeAssistant | undefined, entityIds: readonly string[], hours: number, now: Date): void {
    const ids = [...new Set(entityIds)];
    if (!this.connected || !hass || hours < 1 || !ids.length || typeof hass.callWS !== "function") {
      if (this.data) {
        this.data = undefined;
        this.host.requestUpdate();
      }
      this.key = undefined;
      return;
    }
    const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    const key = `${ids.join(",")}|${hours}|${currentHour}`;
    if (key === this.key) return;
    this.key = key;
    // Another place: its history is not the one on screen, so show none until it arrives.
    if (this.ids !== undefined && this.ids !== ids.join(",")) this.data = undefined;
    this.ids = ids.join(",");

    hass
      .callWS<Record<string, HistoryState[]>>({
        type: "history/history_during_period",
        start_time: new Date(currentHour - hours * HOUR_MS).toISOString(),
        end_time: new Date(currentHour).toISOString(),
        entity_ids: ids,
        include_start_time_state: true,
        significant_changes_only: false,
        minimal_response: false,
        no_attributes: false,
      })
      .then((result) => {
        if (this.key !== key) return; // superseded
        this.data = result;
        this.host.requestUpdate();
      })
      .catch(() => {
        if (this.key === key) this.key = undefined; // retry on the next configure()
      });
  }
}
