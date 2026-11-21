import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import type { ScaleLevel, ScaleMetric } from "../utils/scales";
import { metricIcon } from "./icons";

export interface MetricView {
  metric: ScaleMetric;
  /** Already-formatted value with unit, e.g. `10 km/h ESE`. */
  value: string;
  level: ScaleLevel;
  levelLabel: string;
  /** Accessible name of the metric (visually hidden). */
  name: string;
  /** Custom sensor behind the metric: tapping it opens its more-info (history). Absent for the weather entity's own value. */
  entity?: string;
}

/** Humidity / wind / UV strip: level label, icon + value and a 5-segment scale bar. */
/**
 * `onActivate` handles both `click` and `keydown` of the metrics backed by a sensor (see `isActivation`); the
 * sensor is in `data-entity`, so one stable handler serves every metric.
 */
export function renderAttributes(metrics: readonly MetricView[], onActivate: (event: Event) => void): TemplateResult {
  const columns = metrics.map((m) => `minmax(0, ${WEIGHT[m.metric]}fr)`).join(" ");
  return html`<div class="attributes" style="--columns:${columns}">${metrics.map((m) => renderMetric(m, onActivate))}</div>`;
}

/** Wind carries the longest text ("10 km/h ESE"), so it gets a wider column. */
const WEIGHT: Record<ScaleMetric, number> = { humidity: 1, wind: 1.45, uv: 1 };

function renderMetric(m: MetricView, onActivate: (event: Event) => void): TemplateResult {
  const entity = m.entity;
  return html`
    <div
      class="metric ${entity ? "interactive" : ""}"
      style="--level:var(--hfc-${m.metric}-${m.level + 1})"
      role=${entity ? "button" : nothing}
      tabindex=${entity ? 0 : nothing}
      data-entity=${entity ?? nothing}
      @click=${entity ? onActivate : nothing}
      @keydown=${entity ? onActivate : nothing}
    >
      <span class="level">${m.levelLabel}</span>
      <div class="value">
        ${metricIcon(m.metric)}
        <span class="sr-only">${m.name}</span>
        <span>${m.value}</span>
      </div>
      <div class="scale" aria-hidden="true">
        ${[0, 1, 2, 3, 4].map(
          (i) => html`<span class=${i === m.level ? "on" : ""} style="background:var(--hfc-${m.metric}-${i + 1})"></span>`,
        )}
      </div>
    </div>
  `;
}
