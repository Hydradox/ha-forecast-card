import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    container-type: inline-size; /* responsive to the card width, not the viewport */
  }
  ha-card {
    position: relative;
    overflow: hidden;
    isolation: isolate; /* the effect layer sits behind the content, inside the card */
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--hfc-text);
  }
  ha-card.interactive,
  .temperature.interactive {
    cursor: pointer;
  }
  ha-card:focus-visible,
  .temperature:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .header .info {
    flex: 1 1 0; /* takes what the temperature leaves and shrinks (never pushes it) */
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;
  }
  .header .info > * {
    max-width: 100%;
  }
  .condition {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .condition svg {
    flex: none;
  }
  .secondary {
    color: var(--hfc-text-secondary);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .state {
    font-size: 16px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .temperature {
    flex: none;
    font-size: 56px;
    font-weight: 400;
    line-height: 1;
  }
  .temperature .unit {
    font-size: 20px;
    font-weight: 400;
    color: var(--hfc-text-secondary);
  }
  /* Narrow card: temperature on top, details below, so nothing overlaps */
  @container (max-width: 300px) {
    .header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .header .info {
      flex: none;
      width: 100%;
      align-items: flex-start;
      text-align: left;
    }
    .temperature {
      font-size: 44px;
    }
  }
  .empty {
    color: var(--hfc-text-secondary);
    text-align: center;
    padding: 24px 0;
  }

  .sprite {
    position: absolute;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .range {
    font-size: 13px;
    color: var(--hfc-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Tabs */
  .tabs {
    position: relative;
    display: flex;
    border-bottom: 1px solid var(--hfc-divider);
  }
  .tabs button {
    flex: 1;
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--hfc-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.25s;
  }
  .tabs button[aria-pressed="true"] {
    color: var(--hfc-accent-text);
  }
  /* Sliding underline: one bar that moves under the selected tab (two tabs at most). */
  .tabs::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: -1px;
    width: 50%;
    height: 3px;
    background: var(--hfc-accent);
    transition: transform 0.25s ease-out;
  }
  .tabs:has(button:last-child[aria-pressed="true"])::after {
    transform: translateX(100%);
  }
  @media (prefers-reduced-motion: reduce) {
    .tabs::after,
    .tabs button {
      transition: none;
    }
  }
  .tabs button:focus-visible {
    outline: 2px solid var(--hfc-accent);
    outline-offset: -2px;
  }

  /* Forecast */
  .forecast {
    position: relative;
    min-height: 180px;
    min-width: 0;
  }
  .forecast[data-sliding] {
    overflow: clip;
  }
  /* The chart being replaced, drawn over the new one while it slides out. */
  .scroller.ghost {
    position: absolute;
    inset: 0 0 auto 0;
    pointer-events: none;
  }
  .scroller {
    overflow-x: auto;
    /* Thin scrollbar, revealed on hover or keyboard focus so it stays out of the way. */
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    padding-bottom: 6px;
  }
  .scroller:hover,
  .scroller:focus-visible {
    scrollbar-color: var(--hfc-divider) transparent;
  }
  .scroller.scrollable {
    cursor: grab;
  }
  .scroller[data-dragging] {
    cursor: grabbing;
    user-select: none;
  }
  .scroller:focus-visible {
    outline: 2px solid var(--hfc-accent);
    outline-offset: 2px;
    border-radius: 8px;
  }
  .scroller.scrollable:not([data-end]) {
    mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent);
  }
  .grid {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    justify-items: center;
  }
  .row.labels {
    row-gap: 4px;
    font-size: 12px;
    color: var(--hfc-text-secondary);
  }
  .row.labels .current {
    font-weight: 500;
    color: var(--hfc-accent-text);
  }
  .row.icons {
    padding: 4px 0;
  }
  .row.rain {
    padding-top: 2px;
  }
  .amount {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 30px;
    line-height: 14px;
    color: var(--hfc-rain-text);
  }
  .amount b {
    font-size: 13px;
    font-weight: 500;
  }
  .amount small {
    font-size: 11px;
  }
  .row.rain > span:empty {
    height: 30px;
  }
  svg text {
    font-family: inherit;
    text-anchor: middle;
    fill: var(--hfc-text);
    font-size: 14px;
    font-weight: 500;
  }
  svg text.label-min {
    fill: var(--hfc-text-secondary);
    font-size: 13px;
    font-weight: 400;
  }
  svg .bar {
    fill: var(--hfc-rain-bar);
  }
  svg .baseline {
    stroke: var(--hfc-divider);
    stroke-width: 1;
  }
  svg .line,
  svg .line-min {
    fill: none;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  svg .line {
    stroke-width: 2.5;
  }
  svg .line-min {
    stroke: var(--hfc-text-secondary);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }
  svg .dot {
    fill: var(--hfc-surface);
    stroke-width: 2.5;
  }
  svg .dot-min {
    fill: var(--hfc-surface);
    stroke: var(--hfc-text-secondary);
    stroke-width: 2;
  }

  /* Alerts */
  .alerts {
    min-width: 0;
    cursor: default; /* the card itself may be clickable; alerts are not part of that action */
    /* Tall lists scroll inside the card instead of stretching it; pinned alerts scroll with the rest. */
    max-height: var(--hfc-alerts-max-height, 300px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--hfc-divider) transparent;
  }
  .alerts:focus-visible {
    outline: 2px solid var(--hfc-accent);
    outline-offset: -2px;
    border-radius: 8px;
  }
  .alerts-pinned,
  .alerts-more {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .alerts-more {
    padding-top: 8px;
  }
  /* Slide open/closed: animating grid rows 0fr → 1fr gives a smooth height from "auto". */
  .collapse {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    transition:
      grid-template-rows 0.25s ease,
      visibility 0s 0.25s;
  }
  .collapse[data-open] {
    grid-template-rows: 1fr;
    visibility: visible;
    transition-delay: 0s;
  }
  .collapse-inner {
    min-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .collapse[data-open] > .collapse-inner {
    opacity: 1;
  }
  .alert {
    display: flex;
    gap: 12px;
    flex: none;
    padding: 10px 8px 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--level) 14%, var(--hfc-surface));
    border: 1px solid color-mix(in srgb, var(--level) 60%, transparent);
  }
  .alert.expandable {
    cursor: pointer;
  }
  .alert.expandable:hover {
    background: color-mix(in srgb, var(--level) 22%, var(--hfc-surface));
  }
  .alert-icon {
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: 50%;
    background: var(--level);
    color: var(--on);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .alert-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-self: center;
  }
  .alert-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    font-size: 14px;
    font-weight: 500;
  }
  .alert-chip {
    padding: 1px 8px;
    border-radius: 10px;
    background: var(--level);
    color: var(--on);
    font-size: 11px;
    font-weight: 500;
  }
  .alert-meta {
    font-size: 12px;
    color: var(--hfc-text-secondary);
  }
  .alert-text {
    display: block;
    padding-top: 2px;
    font-size: 13px;
    line-height: 18px;
    overflow-wrap: anywhere;
  }
  .alert-toggle {
    flex: none;
    align-self: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    border-radius: 22px;
    background: transparent;
    color: var(--hfc-text);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .alert-toggle:focus-visible {
    outline: 2px solid var(--hfc-accent);
    outline-offset: -2px;
  }
  .alert-toggle .chevron {
    transition: transform 0.15s;
  }
  .alert-toggle.open .chevron {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .alert-toggle .chevron,
    .collapse,
    .collapse-inner {
      transition: none;
    }
  }

  /* Humidity / wind / UV strip */
  .attributes {
    display: grid;
    grid-template-columns: var(--columns);
  }
  .metric {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 0 10px;
    border-left: 1px solid var(--hfc-divider);
  }
  .metric:first-child {
    padding-left: 0;
    border-left: 0;
  }
  .metric:last-child {
    padding-right: 0;
  }
  .metric .level {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    color: color-mix(in srgb, var(--level) 70%, var(--hfc-text));
  }
  .metric .value {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    color: color-mix(in srgb, var(--level) 70%, var(--hfc-text));
  }
  .metric .value > span:last-child {
    color: var(--hfc-text);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .metric-icon {
    flex: none;
  }
  .scale {
    display: flex;
    gap: 2px;
  }
  .scale span {
    flex: 1;
    height: 5px;
    border-radius: 2px;
    opacity: 0.3;
  }
  .scale span.on {
    opacity: 1;
  }
  @container (max-width: 320px) {
    .attributes {
      grid-template-columns: 1fr;
      row-gap: 12px;
    }
    .metric,
    .metric:first-child,
    .metric:last-child {
      padding: 0;
      border-left: 0;
    }
  }
`;
