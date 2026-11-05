import type { TemplateResult } from "lit";
import { html } from "lit";
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
}

/** Humidity / wind / UV strip: level label, icon + value and a 5-segment scale bar. */
export function renderAttributes(metrics: readonly MetricView[]): TemplateResult {
  return html`<div class="attributes" style="--n:${metrics.length}">${metrics.map(renderMetric)}</div>`;
}

function renderMetric(m: MetricView): TemplateResult {
  return html`
    <div class="metric" style="--level:var(--hfc-${m.metric}-${m.level + 1})">
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
