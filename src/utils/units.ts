/** Normalisation to the units the scales/ramps are defined in. Display keeps the entity's own unit. */

export type TemperatureUnit = "°C" | "°F";

/** Anything that is not Fahrenheit is treated as Celsius (HA only ships those two). */
export function temperatureUnit(unit: string | undefined): TemperatureUnit {
  return unit === "°F" ? "°F" : "°C";
}

export function convertTemperature(value: number, from: string | undefined, to: string | undefined): number {
  const source = temperatureUnit(from);
  const target = temperatureUnit(to);
  if (source === target) return value;
  return source === "°C" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}

/** Canonical unit of every internal scale and ramp. */
export const toCelsius = (value: number, unit: string | undefined): number =>
  convertTemperature(value, unit, "°C");

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
