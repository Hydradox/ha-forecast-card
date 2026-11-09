import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import { gusts, hailStones, rainDrops, snowFlakes, stars } from "./particles";
import type { Cloud, EffectSpec, Pair } from "./specs";
import { effectFor } from "./specs";

const pick = (pair: Pair, dark: boolean): string => pair[dark ? 1 : 0];

function bolt(left: number, delay: number, mirror: boolean): TemplateResult {
  return html`<span class="strike" style="left:${left}%;--d:${delay}s"
    ><span class="glow"></span
    ><svg class="bolt ${mirror ? "mirror" : ""}" width="48" height="128" viewBox="0 0 48 128">
      <polyline class="seg" pathLength="1" points="26,0 16,30 27,33 12,66 24,69 8,112" />
      <polyline class="seg2" pathLength="1" points="24,69 36,92" />
    </svg
  ></span>`;
}

const cloud = ([top, side, offset, w, h, delay, duration]: Cloud): TemplateResult =>
  html`<span
    class="cloud"
    style="top:${top}px;${side === "l" ? "left" : "right"}:${offset}%;width:${w}px;height:${h}px;--d:${delay}s;--t:${duration ?? 14}s"
  ></span>`;

const band = ([top, left, width, duration, delay]: readonly number[], height: number): TemplateResult =>
  html`<span class="fog" style="top:${top}px;left:${left}%;width:${width}%;height:${height}px;--t:${duration}s;--d:${delay}s"></span>`;

function build(spec: EffectSpec, dark: boolean): TemplateResult {
  const style = [
    `--tint:${pick(spec.tint, dark)}`,
    spec.tintEnd ? `--tint-end:${pick(spec.tintEnd, dark)}` : "",
    spec.wash ? `--wash:${pick(spec.wash.color, dark)};--wash-at:${spec.wash.at};--wash-stop:${spec.wash.stop}%` : "",
    spec.clouds ? `--cloud:${pick(spec.clouds.color, dark)}` : "",
    spec.fog ? `--fog:${pick(spec.fog.backColor, dark)}` : "",
  ]
    .filter(Boolean)
    .join(";");
  const glow = spec.glow;
  const fog = spec.fog;

  return html`
    <div class="fx ${dark ? "dark" : ""} ${spec.tintEnd ? "dense" : ""} ${spec.wash ? "washed" : ""}" style=${style} aria-hidden="true">
      ${glow
        ? html`<span
            class="glow-${glow.kind}"
            style="top:${glow.top}px;${glow.side === "l" ? "left" : "right"}:${glow.offset};width:${glow.size};--c:${pick(glow.color, dark)}"
          ></span>`
        : nothing}
      ${spec.stars ? stars(spec.stars).map((s) => html`<i class="star" style=${s}></i>`) : nothing}
      ${spec.clouds ? spec.clouds.items.map(cloud) : nothing}
      ${fog ? fog.back.map((b) => band(b, 30)) : nothing}
      ${spec.rain ? rainDrops(spec.rain.count, spec.rain.heavy).map((s) => html`<i class="drop" style=${s}></i>`) : nothing}
      ${spec.snow ? snowFlakes(spec.snow).map((s) => html`<i class="flake" style=${s}></i>`) : nothing}
      ${spec.hail ? hailStones(spec.hail).map((s) => html`<i class="hailstone" style=${s}></i>`) : nothing}
      ${spec.gusts ? gusts(spec.gusts).map((s) => html`<i class="gust" style=${s}></i>`) : nothing}
      ${spec.lightning ? html`${bolt(42, 0, false)}${bolt(47, -3, true)}` : nothing}
    </div>
    ${fog
      ? html`<div class="fx front ${dark ? "dark" : ""}" style="--fog:${pick(fog.frontColor, dark)}" aria-hidden="true">
          ${fog.front.map((b) => band(b, 40))}
        </div>`
      : nothing}
  `;
}

const cache = new Map<string, TemplateResult>();

/**
 * Decorative layer for a weather condition, drawn behind the card content. The template is
 * built once per condition/theme and reused (particle layouts are seeded, not random).
 */
export function renderWeatherEffect(condition: string | undefined, dark: boolean): TemplateResult | typeof nothing {
  const spec = effectFor(condition);
  if (!spec || !condition) return nothing;
  const key = `${condition}|${dark}`;
  let template = cache.get(key);
  if (!template) cache.set(key, (template = build(spec, dark)));
  return template;
}
