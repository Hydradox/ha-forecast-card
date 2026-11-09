/**
 * Festivity calendar. Windows are inclusive and use the viewer's local date. Fixed-date festivities
 * win over movable ones when they overlap, in the order of `PRECEDENCE`.
 */

/**
 * Always keep this list in calendar order (by the day each festivity starts in the year). The editor, its
 * dropdown and the docs all follow it, and a test enforces it. Movable festivities are placed by a typical year.
 */
export const FESTIVITIES = [
  "epiphany", // Jan 2
  "valentine", // Feb 10
  "carnival", // mid Feb (movable)
  "fallas", // Mar 15
  "easter", // late Mar / Apr (movable)
  "halloween", // Oct 24
  "christmas", // Dec 1
  "new_year", // Dec 27
] as const;

export type Festivity = (typeof FESTIVITIES)[number];

export function isFestivity(value: unknown): value is Festivity {
  return typeof value === "string" && (FESTIVITIES as readonly string[]).includes(value);
}

/** Easter Sunday of `year` (Gregorian, Meeus/Jones/Butcher). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { month: Math.floor(n / 31), day: (n % 31) + 1 };
}

const dayNumber = (year: number, month: number, day: number): number => Date.UTC(year, month - 1, day) / 86_400_000;

/** Per-festivity user rules. Fixed festivities use `start`/`end` (`MM-DD`), movable ones day offsets from Easter Sunday. */
export interface FestivityRule {
  enabled?: boolean;
  start?: string;
  end?: string;
  start_offset?: number;
  end_offset?: number;
}
export type FestivityRules = Partial<Record<Festivity, FestivityRule>>;

/** Default windows of the fixed festivities, `MM-DD` inclusive; `new_year` wraps over the turn of the year. */
export const FIXED_WINDOWS = {
  fallas: ["03-15", "03-19"],
  valentine: ["02-10", "02-14"],
  halloween: ["10-24", "11-01"],
  christmas: ["12-01", "12-26"],
  new_year: ["12-27", "01-01"],
  epiphany: ["01-02", "01-06"],
} as const satisfies Record<string, readonly [string, string]>;

/** Default windows of the movable festivities, in days from Easter Sunday. */
export const MOVABLE_WINDOWS = {
  easter: [-7, 1], // Palm Sunday to Easter Monday
  carnival: [-52, -47], // Thursday before Shrove Tuesday to Shrove Tuesday
} as const satisfies Record<string, readonly [number, number]>;

/** Festivities that stay off in `auto` until the user turns them on (`festivities.<name>.enabled: true`). */
export const DISABLED_BY_DEFAULT: readonly Festivity[] = ["fallas"];

export const isEnabledByDefault = (id: Festivity): boolean => !DISABLED_BY_DEFAULT.includes(id);

export const isMovable = (id: Festivity): id is keyof typeof MOVABLE_WINDOWS => id in MOVABLE_WINDOWS;

const PRECEDENCE: readonly Festivity[] = ["fallas", "valentine", "halloween", "christmas", "new_year", "epiphany", "easter", "carnival"];

/** `MM-DD` → `MMDD` number, or undefined when it is not a real calendar day (29 Feb is allowed). */
export function parseMonthDay(value: unknown): number | undefined {
  const match = typeof value === "string" ? /^(\d{1,2})-(\d{1,2})$/.exec(value.trim()) : null;
  if (!match) return undefined;
  const [month, day] = [Number(match[1]), Number(match[2])];
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(2000, month, 0)).getUTCDate()) return undefined;
  return month * 100 + day;
}

/** Whether every rule is well formed (what `parseConfig` enforces). */
export function festivityRulesValid(rules: unknown): boolean {
  if (rules === undefined) return true;
  if (!rules || typeof rules !== "object") return false;
  return Object.entries(rules).every(([id, rule]) => {
    if (!isFestivity(id) || !rule || typeof rule !== "object") return false;
    const r = rule as FestivityRule;
    if (r.enabled !== undefined && typeof r.enabled !== "boolean") return false;
    const dates = isMovable(id) ? [r.start, r.end].every((v) => v === undefined) : [r.start, r.end].every((v) => v === undefined || v === "" || parseMonthDay(v) !== undefined);
    const offsets = isMovable(id)
      ? [r.start_offset, r.end_offset].every((v) => v === undefined || Number.isInteger(v))
      : r.start_offset === undefined && r.end_offset === undefined;
    return dates && offsets;
  });
}

/** Drops rule values equal to the defaults (and empty rules), so saved YAML only holds real changes. */
export function compactFestivityRules(rules: FestivityRules | undefined): FestivityRules | undefined {
  const out: FestivityRules = {};
  for (const id of FESTIVITIES) {
    const rule = rules?.[id];
    if (!rule) continue;
    const defaults: FestivityRule = isMovable(id)
      ? { start_offset: MOVABLE_WINDOWS[id][0], end_offset: MOVABLE_WINDOWS[id][1] }
      : { start: FIXED_WINDOWS[id as keyof typeof FIXED_WINDOWS][0], end: FIXED_WINDOWS[id as keyof typeof FIXED_WINDOWS][1] };
    (defaults as Record<string, unknown>).enabled = isEnabledByDefault(id);
    const kept = Object.fromEntries(
      Object.entries(rule).filter(([key, value]) => value !== undefined && value !== "" && value !== null && value !== (defaults as Record<string, unknown>)[key]),
    );
    if (Object.keys(kept).length) out[id] = kept;
  }
  return Object.keys(out).length ? out : undefined;
}

function inFixed(id: keyof typeof FIXED_WINDOWS, rule: FestivityRule | undefined, mmdd: number): boolean {
  const [dStart, dEnd] = FIXED_WINDOWS[id];
  const start = parseMonthDay(rule?.start) ?? (parseMonthDay(dStart) as number);
  const end = parseMonthDay(rule?.end) ?? (parseMonthDay(dEnd) as number);
  return start <= end ? mmdd >= start && mmdd <= end : mmdd >= start || mmdd <= end;
}

/** The festivity running on `date`, if any. Disabled festivities are skipped. */
export function festivityOn(date: Date, rules?: FestivityRules): Festivity | undefined {
  const year = date.getFullYear();
  const mmdd = (date.getMonth() + 1) * 100 + date.getDate();
  const today = dayNumber(year, date.getMonth() + 1, date.getDate());
  const easter = easterSunday(year);
  const easterDay = dayNumber(year, easter.month, easter.day);
  for (const id of PRECEDENCE) {
    const rule = rules?.[id];
    if (!(rule?.enabled ?? isEnabledByDefault(id))) continue;
    if (isMovable(id)) {
      const [from, to] = MOVABLE_WINDOWS[id];
      const start = easterDay + (rule?.start_offset ?? from);
      const end = easterDay + (rule?.end_offset ?? to);
      if (today >= start && today <= end) return id;
    } else if (inFixed(id, rule, mmdd)) return id;
  }
  return undefined;
}

/**
 * Resolves the `festivity` option. `auto` follows the calendar, `none` disables it, a name forces it,
 * and an entity id (e.g. an `input_select`) takes any of those values from its state. `rules` (enable/dates) only
 * affect `auto`: naming a festivity explicitly always shows it.
 */
export function resolveFestivity(
  option: string | undefined,
  stateOf: (entityId: string) => string | undefined,
  date: Date,
  rules?: FestivityRules,
): Festivity | undefined {
  let value = option ?? "auto";
  if (value.includes(".")) value = stateOf(value) ?? "none";
  if (value === "auto") return festivityOn(date, rules);
  return isFestivity(value) ? value : undefined;
}
