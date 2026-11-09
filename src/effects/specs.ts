/**
 * Weather effect definitions ("Efectos de clima" boards). Pure data: every colour is a
 * `[light, dark]` pair, and the renderer picks one from the theme.
 */

export type Pair = readonly [light: string, dark: string];

/** top px, side, offset %, width px, height px, animation delay s, drift duration s. */
export type Cloud = readonly [top: number, side: "l" | "r", offset: number, w: number, h: number, delay: number, duration?: number];

export interface EffectSpec {
  /** Top gradient colour; `tintEnd` makes it fade to a colour instead of transparent (fog). */
  tint: Pair;
  tintEnd?: Pair;
  /** Radial wash behind the header (sun peeking through clouds). */
  wash?: { at: string; stop: number; color: Pair };
  glow?: { kind: "sun" | "moon" | "alert"; top: number; side: "l" | "r"; offset: string; size: string; color: Pair };
  clouds?: { items: readonly Cloud[]; color: Pair };
  /** Fog bands: [top, left %, width %, duration s, delay s]. */
  fog?: { back: readonly (readonly [number, number, number, number, number])[]; backColor: Pair; front: readonly (readonly [number, number, number, number, number])[]; frontColor: Pair };
  stars?: number;
  rain?: { count: number; heavy?: boolean };
  snow?: number;
  hail?: number;
  gusts?: number;
  lightning?: boolean;
}

const SLATE: Pair = ["rgba(120,144,156,0.22)", "rgba(140,170,200,0.16)"];
const CLOUDS_2: readonly Cloud[] = [
  [-16, "l", 8, 150, 40, 0],
  [-12, "r", 4, 120, 34, -6],
];
const CLOUDS_3: readonly Cloud[] = [
  [-18, "l", 2, 170, 46, 0],
  [-12, "l", 38, 150, 40, -5],
  [-16, "r", 0, 150, 44, -10],
];
const STORM_CLOUDS: readonly Cloud[] = [
  [-16, "l", 6, 170, 44, 0],
  [-12, "r", 2, 140, 38, -6],
];

export const EFFECTS: Readonly<Record<string, EffectSpec>> = {
  sunny: {
    tint: ["rgba(255,213,79,0.14)", "rgba(255,213,79,0.10)"],
    wash: { at: "88% -10%", stop: 58, color: ["rgba(255,179,0,0.34)", "rgba(255,179,0,0.26)"] },
    glow: { kind: "sun", top: -61, side: "r", offset: "0%", size: "160px", color: ["rgba(255,193,7,0.40)", "rgba(255,193,7,0.30)"] },
  },
  "clear-night": {
    tint: ["rgba(63,81,181,0.24)", "rgba(63,81,181,0.32)"],
    glow: { kind: "moon", top: -52, side: "r", offset: "2%", size: "135px", color: ["rgba(197,202,233,0.45)", "rgba(197,202,233,0.22)"] },
    stars: 16,
  },
  partlycloudy: {
    tint: ["rgba(144,164,174,0.18)", "rgba(144,164,174,0.12)"],
    wash: { at: "86% -12%", stop: 52, color: ["rgba(255,179,0,0.28)", "rgba(255,179,0,0.20)"] },
    clouds: {
      items: [
        [-14, "l", 10, 160, 42, 0],
        [-10, "l", 46, 120, 34, -7],
      ],
      color: ["rgba(120,144,156,0.20)", "rgba(140,170,200,0.16)"],
    },
  },
  cloudy: {
    tint: ["rgba(144,164,174,0.36)", "rgba(140,170,200,0.20)"],
    clouds: { items: CLOUDS_3, color: ["rgba(120,144,156,0.24)", "rgba(140,170,200,0.16)"] },
  },
  fog: {
    tint: ["rgba(144,164,174,0.48)", "rgba(176,190,197,0.26)"],
    tintEnd: ["rgba(144,164,174,0.10)", "rgba(176,190,197,0.10)"],
    fog: {
      back: [
        [2, -15, 95, 20, 0],
        [22, 10, 90, 23, -4],
        [44, -25, 100, 26, -8],
        [66, 5, 92, 29, -12],
        [88, -10, 96, 32, -16],
        [108, 15, 85, 35, -20],
      ],
      backColor: ["rgba(144,164,174,0.62)", "rgba(176,190,197,0.34)"],
      front: [
        [10, -10, 80, 26, -7],
        [42, 25, 85, 32, -18],
      ],
      frontColor: ["rgba(207,216,220,0.82)", "rgba(176,190,197,0.42)"],
    },
  },
  rainy: {
    tint: ["rgba(144,164,174,0.30)", "rgba(120,160,200,0.20)"],
    clouds: { items: CLOUDS_2, color: SLATE },
    rain: { count: 26 },
  },
  pouring: {
    tint: ["rgba(96,125,139,0.36)", "rgba(110,150,190,0.28)"],
    clouds: { items: CLOUDS_2, color: SLATE },
    rain: { count: 52, heavy: true },
  },
  "lightning-rainy": {
    tint: ["rgba(84,110,122,0.40)", "rgba(100,130,170,0.28)"],
    clouds: { items: STORM_CLOUDS, color: ["rgba(69,90,100,0.28)", "rgba(120,150,190,0.20)"] },
    rain: { count: 8 },
    lightning: true,
  },
  lightning: {
    tint: ["rgba(84,110,122,0.42)", "rgba(100,130,170,0.30)"],
    clouds: {
      items: [
        [-18, "l", 4, 180, 48, 0],
        [-14, "l", 40, 150, 40, -5],
        [-16, "r", 0, 150, 44, -10],
      ],
      color: ["rgba(69,90,100,0.30)", "rgba(120,150,190,0.22)"],
    },
    lightning: true,
  },
  snowy: {
    tint: ["rgba(144,164,174,0.28)", "rgba(176,196,222,0.18)"],
    clouds: { items: CLOUDS_2, color: ["rgba(144,164,174,0.22)", "rgba(176,196,222,0.16)"] },
    snow: 30,
  },
  "snowy-rainy": {
    tint: ["rgba(120,144,156,0.32)", "rgba(176,196,222,0.22)"],
    clouds: { items: CLOUDS_2, color: ["rgba(120,144,156,0.22)", "rgba(176,196,222,0.16)"] },
    rain: { count: 18 },
    snow: 16,
  },
  hail: {
    tint: ["rgba(96,125,139,0.34)", "rgba(140,170,200,0.24)"],
    clouds: { items: STORM_CLOUDS, color: ["rgba(84,110,122,0.26)", "rgba(140,170,200,0.18)"] },
    hail: 24,
  },
  windy: {
    tint: ["rgba(144,164,174,0.24)", "rgba(140,170,200,0.16)"],
    clouds: {
      items: [
        [-14, "l", 0, 150, 38, 0, 7],
        [-10, "r", 0, 120, 32, -3, 6],
      ],
      color: ["rgba(144,164,174,0.20)", "rgba(140,170,200,0.14)"],
    },
    gusts: 9,
  },
  "windy-variant": {
    tint: ["rgba(144,164,174,0.34)", "rgba(140,170,200,0.22)"],
    clouds: {
      items: [
        [-18, "l", 0, 170, 46, 0, 8],
        [-12, "l", 38, 150, 40, -3, 7],
        [-16, "r", 0, 150, 44, -6, 9],
      ],
      color: ["rgba(120,144,156,0.26)", "rgba(140,170,200,0.18)"],
    },
    gusts: 8,
  },
  exceptional: {
    tint: ["rgba(255,152,0,0.30)", "rgba(255,152,0,0.26)"],
    glow: { kind: "alert", top: -70, side: "l", offset: "20%", size: "60%", color: ["rgba(255,111,0,0.34)", "rgba(255,111,0,0.38)"] },
    clouds: {
      items: [
        [-16, "l", 2, 150, 40, 0],
        [-12, "r", 2, 130, 36, -7],
      ],
      color: ["rgba(255,152,0,0.20)", "rgba(255,152,0,0.16)"],
    },
  },
};

export function effectFor(condition: string | undefined): EffectSpec | undefined {
  return condition ? EFFECTS[condition] : undefined;
}
