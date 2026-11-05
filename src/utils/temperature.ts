/** Shared temperature color ramp (°C → color), used for the icon circle and the chart line. */

interface Stop {
  celsius: number;
  rgb: readonly [number, number, number];
}

const hex = (value: number): readonly [number, number, number] => [
  (value >> 16) & 255,
  (value >> 8) & 255,
  value & 255,
];

export const TEMPERATURE_STOPS: readonly Stop[] = [
  { celsius: -10, rgb: hex(0x5c6bc0) },
  { celsius: 0, rgb: hex(0x039be5) },
  { celsius: 10, rgb: hex(0x26a69a) },
  { celsius: 18, rgb: hex(0x7cb342) },
  { celsius: 24, rgb: hex(0xfdd835) },
  { celsius: 30, rgb: hex(0xfb8c00) },
  { celsius: 36, rgb: hex(0xe53935) },
  { celsius: 42, rgb: hex(0x8e24aa) },
];

/** Linear interpolation between stops; clamped at both ends. Returns `rgb(r g b)`. */
export function temperatureColor(celsius: number): string {
  const first = TEMPERATURE_STOPS[0];
  const last = TEMPERATURE_STOPS[TEMPERATURE_STOPS.length - 1];
  if (celsius <= first.celsius) return toCss(first.rgb);
  if (celsius >= last.celsius) return toCss(last.rgb);

  const upper = TEMPERATURE_STOPS.findIndex((stop) => stop.celsius >= celsius);
  const a = TEMPERATURE_STOPS[upper - 1];
  const b = TEMPERATURE_STOPS[upper];
  const t = (celsius - a.celsius) / (b.celsius - a.celsius);
  return toCss([0, 1, 2].map((i) => Math.round(a.rgb[i] + (b.rgb[i] - a.rgb[i]) * t)));
}

function toCss(rgb: readonly number[]): string {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}
