/**
 * 5-level scales for the attribute strip (humidity, wind, UV).
 * Logic only: colors live in CSS tokens (`--hfc-<metric>-<level>`), so themes decide the look.
 */

export type ScaleMetric = "humidity" | "wind" | "uv";
/** 0-based index (0..4) of the active level. */
export type ScaleLevel = 0 | 1 | 2 | 3 | 4;

/** Upper bounds (exclusive) of levels 0..3; anything above is level 4. */
const THRESHOLDS: Record<ScaleMetric, readonly [number, number, number, number]> = {
  humidity: [30, 40, 60, 80], // % — very dry, dry, comfort, humid, saturated
  wind: [20, 40, 60, 90], // km/h — light, moderate, strong, intense, storm
  uv: [3, 6, 8, 11], // WHO index — low, moderate, high, very high, extreme
};

/** Translation keys for each level, aligned with the level index. */
export const LEVEL_KEYS: Record<ScaleMetric, readonly [string, string, string, string, string]> = {
  humidity: ["very_dry", "dry", "comfort", "humid", "saturated"],
  wind: ["light", "moderate", "strong", "intense", "storm"],
  uv: ["low", "moderate", "high", "very_high", "extreme"],
};

export function getLevel(metric: ScaleMetric, value: number): ScaleLevel {
  const limits = THRESHOLDS[metric];
  const index = limits.findIndex((limit) => value < limit);
  return (index === -1 ? 4 : index) as ScaleLevel;
}
