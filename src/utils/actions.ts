import type { ActionConfig, HomeAssistant } from "../types/ha";

export const ACTIONS = [
  "more-info",
  "navigate",
  "url",
  "perform-action",
  "call-service",
  "toggle",
  "none",
] as const;

export function isActionConfig(value: unknown): value is ActionConfig {
  return (
    !!value &&
    typeof value === "object" &&
    (ACTIONS as readonly string[]).includes((value as { action?: unknown }).action as string)
  );
}

/** An action that does something (drives the pointer cursor / button semantics). */
export const isInteractive = (action: ActionConfig | undefined): boolean =>
  !!action && action.action !== "none";

function fire(node: EventTarget, type: string, detail?: unknown): void {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/**
 * Runs a Lovelace action. `fallbackEntity` is used by `more-info`/`toggle` when the action has none.
 * Self-contained on purpose: no dependency on frontend internals.
 */
export function runAction(
  node: HTMLElement,
  hass: HomeAssistant,
  action: ActionConfig,
  fallbackEntity: string,
): void {
  switch (action.action) {
    case "more-info":
      fire(node, "hass-more-info", { entityId: action.entity ?? fallbackEntity });
      break;
    case "navigate":
      if (!action.navigation_path) return;
      history.pushState(null, "", action.navigation_path);
      fire(window, "location-changed", { replace: false });
      break;
    case "url":
      if (action.url_path) window.open(action.url_path, "_blank", "noopener");
      break;
    case "toggle":
      void hass.callService("homeassistant", "toggle", { entity_id: action.entity ?? fallbackEntity });
      break;
    case "perform-action":
    case "call-service": {
      const [domain, service] = (action.perform_action ?? action.service ?? "").split(".");
      if (!domain || !service) return;
      void hass.callService(domain, service, action.data ?? action.service_data, action.target);
      break;
    }
    case "none":
      break;
  }
}
