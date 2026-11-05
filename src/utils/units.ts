/** Normalisation to the units the scales/ramps are defined in. Display keeps the entity's own unit. */

export function toCelsius(value: number, unit: string | undefined): number {
  return unit === "°F" ? ((value - 32) * 5) / 9 : value;
}

const KMH_PER_UNIT: Record<string, number> = {
  "km/h": 1,
  "m/s": 3.6,
  mph: 1.609344,
  "kn": 1.852,
  "ft/s": 1.09728,
};

export function toKmh(value: number, unit: string | undefined): number {
  return value * (KMH_PER_UNIT[unit ?? "km/h"] ?? 1);
}
