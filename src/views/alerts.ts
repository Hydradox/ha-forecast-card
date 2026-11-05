import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import type { Translate } from "../localize";
import type { WeatherAlert } from "../utils/alerts";
import { alertIcon, chevronIcon } from "./icons";

export interface AlertsViewOptions {
  alerts: readonly WeatherAlert[];
  /** Alerts shown while collapsed. */
  maxVisible: number;
  expanded: boolean;
  onToggle: () => void;
  /** Pre-formatted time window per alert id. */
  windows: ReadonlyMap<string, string>;
  localize: Translate;
}

/**
 * Alert banner(s) between the header and the tabs.
 * The `maxVisible` most severe alerts are pinned: they never move, the toggle lives in the first one.
 * Expanding slides open their descriptions and, below them, the remaining alerts. The whole block
 * scrolls vertically once it outgrows `--hfc-alerts-max-height`.
 */
export function renderAlerts(options: AlertsViewOptions): TemplateResult | typeof nothing {
  const { alerts, maxVisible, expanded, localize } = options;
  if (!alerts.length) return nothing;

  const pinned = alerts.slice(0, maxVisible);
  const rest = alerts.slice(maxVisible);
  const expandable = rest.length > 0 || pinned.some((alert) => alert.description);

  // One scroll area holds every alert, so the pinned ones scroll with the rest. They sit at the top
  // and the rest opens below them, so expanding never moves them.
  const scrolls = expanded && rest.length > 0;
  return html`<div
    class="alerts"
    tabindex=${scrolls ? 0 : nothing}
    role=${scrolls ? "region" : nothing}
    aria-label=${scrolls ? localize("alerts.list") : nothing}
  >
    <div class="alerts-pinned">
      ${pinned.map((alert, index) => renderAlert(alert, options, expandable, index === 0 && expandable ? toggle(options, rest.length) : nothing, false))}
    </div>
    ${rest.length
      ? html`<div class="collapse" ?data-open=${expanded} ?inert=${!expanded}>
          <div class="collapse-inner">
            <div class="alerts-more">
              ${rest.map((alert) => renderAlert(alert, options, expandable, nothing, true))}
            </div>
          </div>
        </div>`
      : nothing}
  </div>`;
}

function toggle({ expanded, localize }: AlertsViewOptions, hidden: number): TemplateResult {
  const label = expanded
    ? localize("alerts.hide")
    : hidden > 0
      ? localize("alerts.show_more", { count: hidden })
      : localize("alerts.show_details");
  // No click handler: the click bubbles to the row, which toggles once.
  return html`<button
    type="button"
    class="alert-toggle ${expanded ? "open" : ""}"
    aria-expanded=${expanded}
    aria-label=${label}
  >
    ${!expanded && hidden > 0 ? html`<span>+${hidden}</span>` : nothing}${chevronIcon(24)}
  </button>`;
}

function renderAlert(
  alert: WeatherAlert,
  { windows, localize, expanded, onToggle }: AlertsViewOptions,
  expandable: boolean,
  action: TemplateResult | typeof nothing,
  /** Rows in the scroll list always show their text; pinned ones slide it open. */
  inList: boolean,
): TemplateResult {
  const timeWindow = windows.get(alert.id);
  const meta = [timeWindow, alert.source].filter(Boolean).join(" · ");
  // The whole row toggles (mouse convenience); the chevron button stays the keyboard and screen-reader control.
  const onRowClick = () => {
    if (!window.getSelection?.()?.toString()) onToggle(); // selecting text must not collapse the row
  };
  return html`<div
    class="alert ${expandable ? "expandable" : ""}"
    @click=${expandable ? onRowClick : nothing}
    style="--level: var(--hfc-alert-${alert.level}); --on: var(--hfc-alert-${alert.level}-on)">
    <div class="alert-icon">${alertIcon(alert.kind)}</div>
    <div class="alert-body">
      <div class="alert-title">
        <span>${alert.title}</span>
        <span class="alert-chip">${localize(`alerts.levels.${alert.level}`)}</span>
      </div>
      ${meta ? html`<span class="alert-meta">${meta}</span>` : nothing}
      ${alert.description
        ? html`<div class="collapse" ?data-open=${inList || expanded} ?inert=${!inList && !expanded}>
            <div class="collapse-inner"><span class="alert-text">${alert.description}</span></div>
          </div>`
        : nothing}
    </div>
    ${action}
  </div>`;
}
