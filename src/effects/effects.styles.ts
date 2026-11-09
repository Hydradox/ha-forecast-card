import { css } from "lit";

/**
 * Effect layer styles. Everything animated uses only `transform` and `opacity` (compositor-only),
 * soft shapes are radial gradients instead of `filter: blur`, and the layer is `contain`ed.
 */
export const effectStyles = css`
  .fx {
    position: absolute;
    z-index: -1;
    top: 0;
    left: 0;
    right: 0;
    height: 130px;
    overflow: hidden;
    pointer-events: none;
    contain: strict;
    background: linear-gradient(180deg, var(--tint), var(--tint-end, transparent));
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0, 0, 0, 0.55) 50%, transparent 100%);
    mask-image: linear-gradient(to bottom, #000 0%, rgba(0, 0, 0, 0.55) 50%, transparent 100%);
    /* Particle palette (light), overridden for dark themes */
    --drop: linear-gradient(to bottom, transparent, rgba(55, 71, 79, 0.8));
    --flake: rgba(84, 110, 122, 0.55);
    --gust: linear-gradient(90deg, transparent, rgba(84, 110, 122, 0.85), transparent);
    --star: rgba(63, 81, 181, 0.6);
    --hail: radial-gradient(circle at 35% 30%, #fff 0%, #d6ecf7 55%, #8fc4e0 100%);
    --hail-ring: rgba(79, 150, 190, 0.4);
    --bolt-glow: rgba(255, 214, 0, 0.45);
  }
  .fx.dark {
    --drop: linear-gradient(to bottom, transparent, rgba(176, 196, 222, 0.9));
    --flake: rgba(255, 255, 255, 0.8);
    --gust: linear-gradient(90deg, transparent, rgba(176, 196, 222, 0.85), transparent);
    --star: rgba(232, 234, 246, 0.9);
    --hail: radial-gradient(circle at 35% 30%, #fff 0%, #e1f5fe 55%, #b3e5fc 100%);
    --hail-ring: rgba(179, 229, 252, 0.4);
    --bolt-glow: rgba(170, 200, 255, 0.4);
  }
  .fx.washed {
    background:
      radial-gradient(circle at var(--wash-at), var(--wash) 0%, transparent var(--wash-stop)),
      linear-gradient(180deg, var(--tint), transparent);
  }
  .fx.dense {
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0, 0, 0, 0.75) 55%, transparent 100%);
    mask-image: linear-gradient(to bottom, #000 0%, rgba(0, 0, 0, 0.75) 55%, transparent 100%);
  }
  /* Fog in front of the content (a thin veil over the header). */
  .fx.front {
    z-index: 1;
    height: 100px;
    background: none;
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%);
    mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%);
  }
  .fx > * {
    position: absolute;
  }

  /* Soft shapes */
  .cloud {
    background: radial-gradient(closest-side, var(--cloud), transparent);
    animation: fx-drift var(--t, 14s) ease-in-out var(--d, 0s) infinite alternate;
  }
  .fog {
    background: radial-gradient(closest-side, var(--fog), transparent);
    animation: fx-fog var(--t) ease-in-out var(--d) infinite alternate;
  }
  .glow-sun,
  .glow-moon {
    aspect-ratio: 1;
    border-radius: 50%;
    background: radial-gradient(closest-side, var(--c) 35%, transparent);
    animation: fx-pulse 6s ease-in-out infinite alternate;
  }
  .glow-alert {
    height: 140px;
    background: radial-gradient(ellipse at 50% 40%, var(--c) 0%, transparent 70%);
    animation: fx-pulse 3.2s ease-in-out infinite alternate;
  }

  /* Particles */
  .star {
    left: var(--x);
    top: var(--y);
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: var(--star);
    animation: fx-twinkle var(--t) ease-in-out var(--d) infinite;
  }
  .drop {
    top: 0;
    left: var(--x);
    width: 1.5px;
    height: var(--h);
    opacity: var(--o);
    border-radius: 1px;
    background: var(--drop);
    animation: fx-rain var(--t) linear var(--d) infinite;
  }
  .flake {
    top: 0;
    left: var(--x);
    width: var(--s);
    height: var(--s);
    opacity: var(--o);
    border-radius: 50%;
    background: var(--flake);
    animation: fx-snow var(--t) linear var(--d) infinite;
  }
  .hailstone {
    top: 0;
    left: var(--x);
    width: var(--s);
    height: var(--s);
    opacity: var(--o);
    border-radius: 50%;
    background: var(--hail);
    box-shadow: 0 0 0 1px var(--hail-ring);
    animation: fx-hail var(--t) linear var(--d) infinite;
  }
  .gust {
    left: 0;
    top: var(--y);
    width: var(--w);
    height: 1.5px;
    opacity: var(--o);
    border-radius: 1px;
    background: var(--gust);
    animation: fx-gust var(--t) linear var(--d) infinite;
  }

  /* Lightning: two bolts half a cycle apart */
  .strike {
    top: -4px;
    width: 48px;
    height: 128px;
  }
  .strike > .glow {
    position: absolute;
    top: -26px;
    left: -86px;
    width: 220px;
    height: 170px;
    opacity: 0;
    background: radial-gradient(circle at 50% 30%, var(--bolt-glow) 0%, transparent 65%);
  }
  .bolt {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    opacity: 0;
    fill: none;
    stroke: #ffb300;
    stroke-linejoin: round;
  }
  .bolt.mirror {
    transform: scaleX(-1);
  }
  .seg {
    stroke-width: 2.2;
  }
  .seg2 {
    stroke-width: 1.4;
  }
  .glow,
  .bolt,
  .seg,
  .seg2 {
    animation-duration: 6s;
    animation-delay: var(--d, 0s);
    animation-iteration-count: infinite;
    animation-timing-function: linear;
  }
  .strike > .glow {
    animation-name: fx-glowflash;
  }
  .bolt {
    animation-name: fx-strike;
  }
  .seg,
  .seg2 {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }
  .seg {
    animation-name: fx-draw;
  }
  .seg2 {
    animation-name: fx-draw2;
  }

  /* The drop leans 14° and travels along its own axis: 150px down means 150·tan(14°) ≈ 37px left. */
  @keyframes fx-rain {
    from {
      transform: translate(7px, -30px) rotate(14deg);
    }
    to {
      transform: translate(-30px, 120px) rotate(14deg);
    }
  }
  @keyframes fx-snow {
    0% {
      transform: translate(0, -10px);
    }
    25% {
      transform: translate(8px, 30px);
    }
    50% {
      transform: translate(-6px, 65px);
    }
    75% {
      transform: translate(7px, 98px);
    }
    100% {
      transform: translate(0, 135px);
    }
  }
  @keyframes fx-hail {
    0% {
      transform: translateY(-14px);
      opacity: 0;
      animation-timing-function: cubic-bezier(0.5, 0, 1, 0.8);
    }
    6% {
      opacity: var(--o);
    }
    50% {
      transform: translateY(var(--g));
      animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
    }
    63% {
      transform: translateY(calc(var(--g) - 17px));
      animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.4);
    }
    75% {
      transform: translateY(var(--g));
      animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1);
    }
    83% {
      transform: translateY(calc(var(--g) - 6px));
      animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.4);
    }
    90% {
      transform: translateY(var(--g));
      opacity: var(--o);
    }
    100% {
      transform: translateY(var(--g));
      opacity: 0;
    }
  }
  @keyframes fx-gust {
    from {
      transform: translateX(-140px);
    }
    to {
      transform: translateX(calc(100cqw + 20px));
    }
  }
  @keyframes fx-drift {
    from {
      transform: translateX(-18px);
    }
    to {
      transform: translateX(18px);
    }
  }
  @keyframes fx-fog {
    from {
      transform: translateX(-40px);
    }
    to {
      transform: translateX(40px);
    }
  }
  @keyframes fx-pulse {
    from {
      transform: scale(0.92);
      opacity: 0.85;
    }
    to {
      transform: scale(1.06);
      opacity: 1;
    }
  }
  @keyframes fx-twinkle {
    0%,
    100% {
      opacity: 0.15;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.15);
    }
  }
  @keyframes fx-strike {
    0%,
    85.9% {
      opacity: 0;
    }
    86% {
      opacity: 1;
    }
    90% {
      opacity: 0.25;
    }
    92% {
      opacity: 1;
    }
    95% {
      opacity: 0.5;
    }
    97%,
    100% {
      opacity: 0;
    }
  }
  @keyframes fx-draw {
    0%,
    86% {
      stroke-dashoffset: 1;
    }
    89%,
    100% {
      stroke-dashoffset: 0;
    }
  }
  @keyframes fx-draw2 {
    0%,
    88% {
      stroke-dashoffset: 1;
    }
    90%,
    100% {
      stroke-dashoffset: 0;
    }
  }
  @keyframes fx-glowflash {
    0%,
    88% {
      opacity: 0;
    }
    89% {
      opacity: 1;
    }
    91% {
      opacity: 0.35;
    }
    92.5% {
      opacity: 0.9;
    }
    96% {
      opacity: 0.3;
    }
    98%,
    100% {
      opacity: 0;
    }
  }

  /* Offscreen (or tab hidden): freeze everything, costing no frames */
  :host([data-fx-paused]) .fx *,
  :host([data-fx-paused]) .fx {
    animation-play-state: paused;
  }
  /* Reduced motion: keep the static tint, drop everything that moves */
  @media (prefers-reduced-motion: reduce) {
    .fx *,
    .fx {
      animation: none;
    }
    .drop,
    .flake,
    .hailstone,
    .gust,
    .strike {
      display: none;
    }
    .star {
      opacity: 0.7;
    }
  }
`;
