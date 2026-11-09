import { css, unsafeCSS } from "lit";
import { ART } from "./art";
import { FESTIVITIES } from "./calendar";
import { PALETTES } from "./palettes";

/**
 * Per-festivity palette on the host (`data-festivity`, plus `data-dark`) overriding the theme tokens,
 * and the animation rules of each festivity's art (class and keyframe names are prefixed per festivity).
 */
const palette = FESTIVITIES.map((id) =>
  (["light", "dark"] as const)
    .map((mode) => {
      const p = PALETTES[id][mode];
      return `:host([data-festivity="${id}"]${mode === "dark" ? "[data-dark]" : ""}){--hfc-surface:${p.card};--hfc-divider:${p.border};--hfc-accent:${p.accent};--hfc-accent-text:${p.accentText}}`;
    })
    .join("\n"),
).join("\n");

const art = FESTIVITIES.map((id) => ART[id].css).join("\n");

export const festivityStyles = css`
  ${unsafeCSS(palette)}
  :host([data-festivity]) ha-card {
    background: var(--hfc-surface);
    border-color: var(--hfc-divider);
  }
  .fest {
    display: contents;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    font-weight: 500;
    color: var(--hfc-text);
  }
  .brand svg {
    flex: none;
  }
  .brand .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The corner halo is shown whole: its layer's fade-out mask would cut it off and wash it out. */
  .fest > div:has(> .hw-sunglow) {
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }
  /* Narrow card: the title drops below the temperature, so the top art has the whole corner to itself.
     Drop the title-shaped dimming and stretch the fade-out so the drawing is not cut short. */
  @container (max-width: 300px) {
    .fest > div[style*="top: 0"]:not(:has(> .hw-sunglow)) {
      min-height: 60px;
      -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%) !important;
      mask-image: linear-gradient(to bottom, #000 0%, #000 82%, transparent 100%) !important;
      -webkit-mask-composite: initial !important;
      mask-composite: initial !important;
    }
    /* Epiphany: bring the guiding star into view and move the crown after it. */
    .fest g[transform^="translate(-60"] {
      transform: translate(-196px, 0);
    }
    .fest svg[viewBox="0 0 48 40"] {
      transform: translateX(72px);
    }
  }
  ${unsafeCSS(art)}
  :host([data-fx-paused]) .fest * {
    animation-play-state: paused;
  }
  @media (prefers-reduced-motion: reduce) {
    .fest * {
      animation: none;
    }
  }
`;
