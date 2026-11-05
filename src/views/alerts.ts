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
 * Expanding slides open their descriptions and, below them, the remaining alerts
 * in a list that scrolls vertically once it outgrows `--hfc-alerts-max-height`.
 */
export function renderAlerts(options: AlertsViewOptions): TemplateResult | typeof nothing {
  const { alerts, maxVisible, expanded, localize } = options;
  if (!alerts.length) return nothing;

  const pinned = alerts.slice(0, maxVisible);
  const rest = alerts.slice(maxVisible);
  const expandable = rest.length > 0 || pinned.some((alert) => alert.description);

  return html`<div class="alerts">
    <div class="alerts-pinned">
      ${pinned.map((alert, index) => renderAlert(alert, options, index === 0 && expandable ? toggle(options, rest.length) : nothing, false))}
    </div>
    ${rest.length
      ? html`<div class="collapse" ?data-open=${expanded} ?inert=${!expanded}>
          <div class="collapse-inner">
            <div class="alerts-more">
              <div class="alert-list" tabindex="0" role="region" aria-label=${localize("alerts.list")}>
                ${rest.map((alert) => renderAlert(alert, options, nothing, true))}
              </div>
            </div>
          </div>
        </div>`
      : nothing}
  </div>`;
}

function toggle({ expanded, onToggle, localize }: AlertsViewOptions, hidden: number): TemplateResult {
  const label = expanded
    ? localize("alerts.hide")
    : hidden > 0
      ? localize("alerts.show_more", { count: hidden })
      : localize("alerts.show_details");
  return html`<button
    type="button"
    class="alert-toggle ${expanded ? "open" : ""}"
    aria-expanded=${expanded}
    aria-label=${label}
    @click=${onToggle}
  >
    ${!expanded && hidden > 0 ? html`<span>+${hidden}</span>` : nothing}${chevronIcon(24)}
  </button>`;
}

function renderAlert(
  alert: WeatherAlert,
  { windows, localize, expanded }: AlertsViewOptions,
  action: TemplateResult | typeof nothing,
  /** Rows in the scroll list always show their text; pinned ones slide it open. */
  inList: boolean,
): TemplateResult {
  const window = windows.get(alert.id);
  const meta = [window, alert.source].filter(Boolean).join(" · ");
  return html`<div class="alert" style="--level: var(--hfc-alert-${alert.level}); --on: var(--hfc-alert-${alert.level}-on)">
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
