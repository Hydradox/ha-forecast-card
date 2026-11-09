import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ART } from "./art";
import type { Patch } from "./art";

function apply(base: string, patches: readonly Patch[]): string {
  let out = "";
  let position = 0;
  for (const [start, end, text] of patches) {
    out += base.slice(position, start) + text;
    position = end;
  }
  return out + base.slice(position);
}

/**
 * The art is drawn for a 360 px card (garlands are 360 px wide, bottom strips 400 px). Wider cards repeat them
 * so they reach both edges; one-off pieces (the Epiphany guiding star) are only kept in the first copy.
 */
const COPIES = 3;
const GUIDING_STAR = /<g transform="translate\(-\d+\s+0\)">.*?<\/g><\/g>/;

export function tile(markup: string): string {
  return markup
    .replace(
      /(<svg width="360" height="34" viewBox="0 0 360 34" style="position: absolute; top: 0; )left: 0(" aria-hidden="true">)(.*?)(<\/svg>)/g,
      (whole, head: string, mid: string, body: string, end: string) => {
        let out = whole;
        for (let copy = 1; copy < COPIES; copy++) {
          out += `${head}left: ${copy * 360}px${mid}${body.replace(GUIDING_STAR, "")}${end}`;
        }
        return out;
      },
    )
    .replace(
      /(<div aria-hidden="true" style="[^"]*bottom: 0;[^"]*)(">)<svg (width="\d+" height="\d+" viewBox="[^"]*")>(.*?)<\/svg><\/div>/g,
      (_whole, head: string, close: string, attrs: string, body: string) =>
        `${head}; display: flex${close}${`<svg ${attrs} style="flex: none">${body}</svg>`.repeat(COPIES)}</div>`,
    );
}

/** Static decorative markup from our own art table (never user input), built once per festivity/theme. */
const cache = new Map<string, { layers: TemplateResult; brand: TemplateResult }>();

function build(id: string, dark: boolean) {
  const key = `${id}|${dark}`;
  let entry = cache.get(key);
  if (!entry) {
    const art = ART[id];
    entry = {
      layers: html`<div class="fest" aria-hidden="true">${unsafeHTML(tile(dark ? apply(art.layers, art.layersDark) : art.layers))}</div>`,
      brand: html`${unsafeHTML(dark ? apply(art.brand, art.brandDark) : art.brand)}`,
    };
    cache.set(key, entry);
  }
  return entry;
}

/** Decoration layers (top ambience, corner, bottom strip), drawn behind the content and above the weather effect. */
export function renderFestivityLayers(id: string | undefined, dark: boolean): TemplateResult | typeof nothing {
  return id && ART[id] ? build(id, dark).layers : nothing;
}

/** Small icon shown before the card name. */
export function renderFestivityBrand(id: string | undefined, dark: boolean): TemplateResult | typeof nothing {
  return id && ART[id] ? build(id, dark).brand : nothing;
}
