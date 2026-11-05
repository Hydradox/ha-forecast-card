import { css } from "lit";

/**
 * Design tokens. Every value derives from Home Assistant theme variables, so the HA
 * light/dark themes and third-party themes (Mushroom, etc.) apply with no theme code here.
 * Users can override any `--hfc-*` variable via card-mod or a theme.
 */
export const tokens = css`
  :host {
    /* Surface & text */
    --hfc-text: var(--primary-text-color);
    --hfc-text-secondary: var(--secondary-text-color);
    --hfc-divider: var(--divider-color);
    --hfc-accent: var(--primary-color);
    --hfc-radius: var(--ha-card-border-radius, 12px);

    /* Precipitation bars */
    --hfc-rain: var(--info-color, var(--primary-color));

    /* 5-level scales: from low to high. Semantic HA colors with sane fallbacks. */
    --hfc-humidity-1: var(--warning-color, #ffa600);
    --hfc-humidity-2: var(--state-light-active-color, #fdd835);
    --hfc-humidity-3: var(--success-color, #43a047);
    --hfc-humidity-4: var(--info-color, #039be5);
    --hfc-humidity-5: var(--indigo-color, #5c6bc0);

    --hfc-wind-1: var(--success-color, #43a047);
    --hfc-wind-2: var(--state-light-active-color, #fdd835);
    --hfc-wind-3: var(--warning-color, #ffa600);
    --hfc-wind-4: var(--error-color, #db4437);
    --hfc-wind-5: var(--purple-color, #8e24aa);

    --hfc-uv-1: var(--hfc-wind-1);
    --hfc-uv-2: var(--hfc-wind-2);
    --hfc-uv-3: var(--hfc-wind-3);
    --hfc-uv-4: var(--hfc-wind-4);
    --hfc-uv-5: var(--hfc-wind-5);
  }
`;
