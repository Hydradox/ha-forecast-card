import type { TemplateResult } from "lit";
import { html, nothing, svg } from "lit";
import type { Translate } from "../localize";
import type { Formatters } from "../utils/format";
import type { RainMode, Slot } from "../utils/forecast-view";
import { RAIN_FLOOR, barHeight, createScale, defined, extent, rainMode, rainValue } from "../utils/forecast-view";
import type { Thresholds } from "../utils/temperature";
import { temperatureColor } from "../utils/temperature";
import { toCelsius } from "../utils/units";
import { weatherIcon } from "./icons";

export type ChartKind = "hourly" | "daily";

export interface ChartInput {
  kind: ChartKind;
  slots: readonly Slot[];
  /** Available width in px (the chart never gets narrower than `slots × minColumn`). */
  width: number;
  temperatureUnit: string;
  precipitationUnit: string;
  thresholds: Thresholds;
  fmt: Formatters;
  localize: Translate;
}

interface ColumnRules {
  minColumn: number;
  minVisible: number;
  /** Most columns shown at once; wider charts scroll instead of squeezing more in. */
  maxVisible?: number;
}

/**
 * Column sizing shared by both views (tune here, not per view): no column gets narrower than `minColumn`,
 * and with history the visible area is divided into at least `minVisible` columns.
 */
const COLUMNS: ColumnRules = { minColumn: 54, minVisible: 4 };

/** Per-view overrides of `COLUMNS`: the daily view never squeezes in more than 7 days at once. */
const COLUMNS_BY_KIND: Record<ChartKind, ColumnRules> = {
  hourly: COLUMNS,
  daily: { ...COLUMNS, maxVisible: 7 },
};

/** Layout per kind, matching the design boards (E1 hourly, E3 daily). */
const LAYOUT = {
  hourly: { minColumn: COLUMNS.minColumn, height: 98, top: 20, bottom: 60, bars: 70, icon: 30, radius: 4, line: 2.5 },
  daily: { minColumn: COLUMNS.minColumn, height: 100, top: 20, bottom: 80, bars: 80, icon: 28, radius: 3.5, line: 2.5 },
} as const;

/** Without rain there are no bars, so the temperature line takes the space and the rain row is dropped. */
const DRY = {
  hourly: { height: 104, bottom: 82 },
  daily: { height: 112, bottom: 88 },
} as const;

/** Whether the chart (with its `past` recorded columns) is wider than `available`, so the card shows it as a scroller. */
export function isScrollable(kind: ChartKind, available: number, columns: number, past: number): boolean {
  if (available <= 0) return false;
  if (past > 0) return true;
  return columnWidth(available, columns, false, COLUMNS_BY_KIND[kind]) * columns > available + 0.5;
}

/**
 * Width of one column. The visible columns stretch to fill `available`; with history, a handful of columns
 * (or just one) must not balloon to the full width, so fewer than `minVisible` are sized as if that many
 * were shown.
 */
export function columnWidth(available: number, visible: number, hasPast: boolean, { minColumn, minVisible, maxVisible }: ColumnRules = COLUMNS): number {
  const shown = hasPast ? Math.max(visible, minVisible) : visible;
  return Math.max(available / shown, minColumn, maxVisible ? available / maxVisible : 0);
}

/** Number of leading recorded (past) slots; they sit off-screen to the left of "Now". */
export const pastCount = (slots: readonly Slot[]): number => slots.filter((slot) => slot.isPast).length;

export function renderChart(input: ChartInput): TemplateResult | typeof nothing {
  const { kind, slots, fmt, localize } = input;
  if (!slots.length) return html`<div class="empty">${localize("common.no_forecast")}</div>`;

  const columns = slots.length;
  // Past slots extend the chart to the left, off-screen; trailing padding lets "Now" scroll all the way
  // to the left edge.
  const past = pastCount(slots);
  const visible = columns - past;
  const column = columnWidth(input.width, visible, past > 0, COLUMNS_BY_KIND[kind]);
  const width = column * columns;
  const pad = past ? Math.max(input.width - column * visible, 0) : 0;
  const x = (index: number) => (index + 0.5) * column;

  const maxSeries = slots.map((slot) => slot.temperature);
  const minSeries = kind === "daily" ? slots.map((slot) => slot.templow) : [];
  const all = [...maxSeries, ...minSeries].filter(defined);
  const range = extent(all);
  const mode = rainMode(slots);
  const rain = slots.map((slot) => rainValue(slot, mode));
  const dry = !rain.some((value) => defined(value) && value > 0);
  const layout = dry ? { ...LAYOUT[kind], ...DRY[kind] } : LAYOUT[kind];
  const y = range ? createScale(range[0], range[1], layout.top, layout.bottom) : () => layout.top;

  const largest = Math.max(0, ...rain.filter(defined));
  const floor = mode === "probability" ? 100 : input.precipitationUnit === "in" ? RAIN_FLOOR.in : RAIN_FLOOR.mm;
  const barWidth = Math.min(30, column * 0.6);

  const color = (value: number) =>
    temperatureColor(toCelsius(value, input.temperatureUnit), input.thresholds);

  const maxPoints = slots.flatMap((slot, i) => (defined(slot.temperature) ? [{ x: x(i), y: y(slot.temperature), v: slot.temperature }] : []));
  const minPoints = slots.flatMap((slot, i) => (defined(slot.templow) ? [{ x: x(i), y: y(slot.templow), v: slot.templow }] : []));

  return html`
    <div class="grid" style="width:${width}px; padding-right:${pad}px; --cols:${columns}; --col:${column}px">
      <div class="row labels">
        ${slots.map((slot) => html`<span class=${slot.isCurrent ? "current" : slot.isPast ? "past" : ""}>${slot.label}</span>`)}
      </div>
      <div class="row icons">
        ${slots.map((slot) => weatherIcon(slot.condition, layout.icon, slot.isDaytime))}
      </div>
      <svg viewBox="0 0 ${width} ${layout.height}" width=${width} height=${layout.height} role="img" aria-label=${ariaLabel(input, range)}>
        ${gradient(range, y, color)}
        ${rain.map((value, i) => {
          if (!defined(value) || value <= 0) return nothing;
          const h = Math.max(barHeight(value, largest, floor, layout.bars), 2);
          return svg`<rect class="bar" x=${x(i) - barWidth / 2} y=${layout.height - h} width=${barWidth} height=${h} rx="4"/>`;
        })}
        ${dry ? nothing : svg`<line class="baseline" x1="0" x2=${width} y1=${layout.height - 0.5} y2=${layout.height - 0.5}/>`}
        ${minPoints.length
          ? svg`<polyline class="line-min" points=${polyline(minPoints)}/>
              ${minPoints.map((p) => svg`<circle class="dot-min" cx=${p.x} cy=${p.y} r="3"/>
                <text class="label-min" x=${p.x} y=${p.y + 15}>${fmt.number(p.v)}°</text>`)}`
          : nothing}
        <polyline class="line" points=${polyline(maxPoints)} stroke=${range ? "url(#hfc-gradient)" : "currentColor"}/>
        ${maxPoints.map((p) => svg`<circle class="dot" cx=${p.x} cy=${p.y} r=${layout.radius} stroke=${range ? "url(#hfc-gradient)" : "currentColor"}/>
          <text class="label" x=${p.x} y=${p.y - (kind === "hourly" ? 10 : 8)}>${fmt.number(p.v)}°</text>`)}
      </svg>
      ${dry ? nothing : html`<div class="row rain">${rain.map((value) => rainLabel(value, mode, input))}</div>`}
    </div>
  `;
}

function polyline(points: readonly { x: number; y: number }[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Vertical gradient sampled from the temperature colour ramp, so thresholds shape the line colour. */
function gradient(
  range: [number, number] | undefined,
  y: (value: number) => number,
  color: (value: number) => string,
) {
  if (!range || range[0] === range[1]) return nothing;
  const [min, max] = range;
  const stops = [0, 0.33, 0.66, 1].map((f) => {
    const value = max - f * (max - min);
    return svg`<stop offset=${f} stop-color=${color(value)}/>`;
  });
  return svg`<defs><linearGradient id="hfc-gradient" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1=${y(max)} y2=${y(min)}>${stops}</linearGradient></defs>`;
}

function rainLabel(value: number | undefined, mode: RainMode, input: ChartInput): TemplateResult {
  if (!defined(value) || value <= 0) return html`<span></span>`;
  const unit = mode === "probability" ? "%" : input.precipitationUnit;
  const digits = mode === "probability" ? 0 : input.precipitationUnit === "in" ? 2 : 1;
  return html`<span class="amount"><b>${input.fmt.number(value, digits)}</b><small>${unit}</small></span>`;
}

function ariaLabel(input: ChartInput, range: [number, number] | undefined): string {
  if (!range) return input.localize("chart.no_data");
  return input.localize(input.kind === "hourly" ? "chart.label_hourly" : "chart.label_daily", {
    min: input.fmt.number(range[0]),
    max: input.fmt.number(range[1]),
  });
}
