import type { TemplateResult } from "lit";
import { html, svg } from "lit";

/**
 * Weather icons as one `<symbol>` sprite rendered once per card; each icon is a cheap `<use>`.
 * Colours are `--hfc-*` tokens (see styles/tokens.ts), so themes can restyle them.
 */

const sunFill = "fill:var(--hfc-sun-fill);stroke:var(--hfc-sun-stroke)";
const cloudFill = "fill:var(--hfc-cloud-fill);stroke:var(--hfc-cloud-stroke)";
const CLOUD = "M7 19h10.2a4.3 4.3 0 0 0 .7-8.55A6 6 0 0 0 6.4 11.2 4 4 0 0 0 7 19z";
const lines = "fill:none;stroke-linecap:round";

const cloud = (shift = 0) =>
  svg`<path d=${CLOUD} transform=${shift ? `translate(0 ${shift})` : ""} style=${cloudFill} stroke-width="1.6" stroke-linejoin="round"/>`;

const rainLines = (xs: number[]) =>
  svg`<path d=${xs.map((x) => `M${x} 16.5l-1 3`).join("")} style="${lines};stroke:var(--hfc-rain)" stroke-width="1.8"/>`;

const SPRITE = svg`
  <symbol id="hfc-sunny" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4.2" style=${sunFill} stroke-width="1.6"/>
    <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" style="${lines};stroke:var(--hfc-sun-stroke)" stroke-width="1.8"/>
  </symbol>
  <symbol id="hfc-cloudy" viewBox="0 0 24 24">${cloud()}</symbol>
  <symbol id="hfc-partlycloudy" viewBox="0 0 24 24">
    <circle cx="8.5" cy="8.5" r="3.3" style=${sunFill} stroke-width="1.5"/>
    <path d="M8.5 2v1.5M2 8.5h1.5M3.9 3.9l1 1M13.1 3.9l-1 1" style="${lines};stroke:var(--hfc-sun-stroke)" stroke-width="1.6"/>
    <g transform="translate(4.2 4.6) scale(.8)"><path d=${CLOUD} style=${cloudFill} stroke-width="1.8" stroke-linejoin="round"/></g>
  </symbol>
  <symbol id="hfc-clear-night" viewBox="0 0 24 24">
    <path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z" style="fill:var(--hfc-moon-fill);stroke:var(--hfc-moon-stroke)" stroke-width="1.6" stroke-linejoin="round"/>
  </symbol>
  <symbol id="hfc-rainy" viewBox="0 0 24 24">${cloud(-3)}${rainLines([9.5, 13.5, 17.5])}</symbol>
  <symbol id="hfc-pouring" viewBox="0 0 24 24">${cloud(-3)}${rainLines([7.5, 11, 14.5, 18])}<path d="M9.5 20.5l-.8 2M13 20.5l-.8 2M16.5 20.5l-.8 2" style="${lines};stroke:var(--hfc-rain)" stroke-width="1.6"/></symbol>
  <symbol id="hfc-snowy" viewBox="0 0 24 24">${cloud(-3)}<g style="fill:var(--hfc-snow)"><circle cx="8.5" cy="18.5" r="1.4"/><circle cx="12" cy="21" r="1.4"/><circle cx="15.5" cy="18.5" r="1.4"/></g></symbol>
  <symbol id="hfc-snowy-rainy" viewBox="0 0 24 24">${cloud(-3)}${rainLines([9.5])}<circle cx="15" cy="19" r="1.4" style="fill:var(--hfc-snow)"/></symbol>
  <symbol id="hfc-hail" viewBox="0 0 24 24">${cloud(-3)}<g style="fill:var(--hfc-surface);stroke:var(--hfc-rain)" stroke-width="1.4"><circle cx="8.5" cy="18.5" r="1.6"/><circle cx="12" cy="21" r="1.6"/><circle cx="15.5" cy="18.5" r="1.6"/></g></symbol>
  <symbol id="hfc-lightning" viewBox="0 0 24 24">${cloud(-3)}<path d="M13 13.5l-3.5 5H12l-1 4 4.5-6H13z" style="fill:var(--hfc-bolt);stroke:var(--hfc-sun-stroke)" stroke-width="1" stroke-linejoin="round"/></symbol>
  <symbol id="hfc-lightning-rainy" viewBox="0 0 24 24">${cloud(-3)}<path d="M12.5 13.5l-3 4.5H12l-.8 3.5 4-5h-2.5z" style="fill:var(--hfc-bolt);stroke:var(--hfc-sun-stroke)" stroke-width="1" stroke-linejoin="round"/>${rainLines([8, 18])}</symbol>
  <symbol id="hfc-fog" viewBox="0 0 24 24">${cloud(-3)}<path d="M5 18.5h14M8 21.5h8" style="${lines};stroke:var(--hfc-cloud-stroke)" stroke-width="1.8"/></symbol>
  <symbol id="hfc-windy" viewBox="0 0 24 24"><path d="M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5M3 13.5h15a2.5 2.5 0 1 1-2.5 2.5M3 18h7" style="fill:none;stroke:var(--hfc-cloud-stroke);stroke-linecap:round;stroke-linejoin:round" stroke-width="1.8"/></symbol>
  <symbol id="hfc-windy-variant" viewBox="0 0 24 24">${cloud(-4)}<path d="M4 17.5h10a2 2 0 1 0-2-2M4 21h7" style="fill:none;stroke:var(--hfc-cloud-stroke);stroke-linecap:round;stroke-linejoin:round" stroke-width="1.8"/></symbol>
  <symbol id="hfc-exceptional" viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z M12 10v4.5M12 17.2v.1" style="fill:none;stroke:var(--hfc-warning);stroke-linecap:round;stroke-linejoin:round" stroke-width="1.8"/></symbol>
  <symbol id="hfc-humidity" viewBox="0 0 24 24"><path d="M12 2.8s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.3 17.3l5.4-5.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.6" cy="12.7" r="1.2" fill="currentColor"/><circle cx="14.4" cy="16.6" r="1.2" fill="currentColor"/></symbol>
  <symbol id="hfc-wind" viewBox="0 0 24 24"><path d="M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5M3 13.5h15a2.5 2.5 0 1 1-2.5 2.5M3 18h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="hfc-alert" viewBox="0 0 24 24"><path d="M12 3.4l9.2 16H2.8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 10v4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></symbol>
  <symbol id="hfc-alert-rain" viewBox="0 0 24 24"><path d="M7 16h10.2a4.3 4.3 0 0 0 .7-8.55A6 6 0 0 0 6.4 8.2 4 4 0 0 0 7 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 18.5l-1 3M12.5 18.5l-1 3M16.5 18.5l-1 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
  <symbol id="hfc-alert-temperature" viewBox="0 0 24 24"><path d="M10 14.2V5a2 2 0 1 1 4 0v9.2a4 4 0 1 1-4 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="17" r="1.5" fill="currentColor"/></symbol>
  <symbol id="hfc-chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="hfc-uv" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></symbol>
`;

export const iconSprite = html`<svg class="sprite" width="0" height="0" aria-hidden="true"><defs>${SPRITE}</defs></svg>`;

const KNOWN = new Set([
  "sunny", "cloudy", "partlycloudy", "clear-night", "rainy", "pouring", "snowy", "snowy-rainy",
  "hail", "lightning", "lightning-rainy", "fog", "windy", "windy-variant", "exceptional",
]);

/** HA condition → sprite id. Unknown conditions degrade to a cloud; a sunny forecast at night shows the moon. */
export function conditionIcon(condition: string | undefined, isDaytime?: boolean): string {
  if (condition === "sunny" && isDaytime === false) return "clear-night";
  return condition && KNOWN.has(condition) ? condition : "cloudy";
}

export function weatherIcon(condition: string | undefined, size: number, isDaytime?: boolean): TemplateResult {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true"><use href="#hfc-${conditionIcon(condition, isDaytime)}"/></svg>`;
}

export function metricIcon(name: "humidity" | "wind" | "uv", size = 20): TemplateResult {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true" class="metric-icon"><use href="#hfc-${name}"/></svg>`;
}

/** Alert category → sprite id (wind reuses the metric icon). */
const ALERT_ICONS = { wind: "wind", rain: "alert-rain", temperature: "alert-temperature", general: "alert" } as const;

export function alertIcon(kind: keyof typeof ALERT_ICONS, size = 22): TemplateResult {
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true"><use href="#hfc-${ALERT_ICONS[kind]}"/></svg>`;
}

export function chevronIcon(size = 24): TemplateResult {
  return html`<svg class="chevron" width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true"><use href="#hfc-chevron"/></svg>`;
}
