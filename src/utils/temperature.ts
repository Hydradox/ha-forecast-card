/**
 * Shared temperature color ramp (°C → color), used for the icon circle and the chart line.
 *
 * Unit handling: everything internal is °C. Defaults are declared once (`DEFAULT_THRESHOLDS_C`) and
 * converted on demand; user thresholds are stored in the Home Assistant display unit and converted here.
 */
import { convertTemperature, toCelsius } from "./units";

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

export interface Thresholds {
  cold: number;
  hot: number;
}

/** Single declaration of the defaults, in °C. */
export const DEFAULT_THRESHOLDS_C: Readonly<Thresholds> = { cold: 0, hot: 35 };

/** Ramp positions (°C) that `cold` and `hot` are pinned to. With the defaults the mapping is the identity. */
const RAMP_COLD = DEFAULT_THRESHOLDS_C.cold;
const RAMP_HOT = DEFAULT_THRESHOLDS_C.hot;

/** Defaults expressed in `unit` (what the editor shows), rounded to whole degrees. */
export function defaultThresholds(unit: string | undefined): Thresholds {
  return {
    cold: Math.round(convertTemperature(DEFAULT_THRESHOLDS_C.cold, "°C", unit)),
    hot: Math.round(convertTemperature(DEFAULT_THRESHOLDS_C.hot, "°C", unit)),
  };
}

/**
 * Config thresholds (given in `unit`, the HA display unit) → °C. Missing or inconsistent
 * values (cold >= hot) fall back to the defaults.
 */
export function resolveThresholds(
  config: { cold_threshold?: number; hot_threshold?: number },
  unit: string | undefined,
): Thresholds {
  const defaults = defaultThresholds(unit);
  const cold = toCelsius(config.cold_threshold ?? defaults.cold, unit);
  const hot = toCelsius(config.hot_threshold ?? defaults.hot, unit);
  return cold < hot ? { cold, hot } : { ...DEFAULT_THRESHOLDS_C };
}

/** Piecewise-linear remap: `cold`→RAMP_COLD, `hot`→RAMP_HOT, 1:1 slope outside. */
function rampPosition(celsius: number, { cold, hot }: Thresholds): number {
  if (celsius <= cold) return RAMP_COLD + (celsius - cold);
  if (celsius >= hot) return RAMP_HOT + (celsius - hot);
  return RAMP_COLD + ((celsius - cold) / (hot - cold)) * (RAMP_HOT - RAMP_COLD);
}

/** Linear interpolation between stops; clamped at both ends. Returns `rgb(r g b)`. */
export function temperatureColor(value: number, thresholds: Thresholds = DEFAULT_THRESHOLDS_C): string {
  const celsius = rampPosition(value, thresholds);
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
