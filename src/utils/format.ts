import type { HassLocale } from "../types/ha";

/** Locale-aware formatters built once per language/locale (Intl objects are costly to create). */
export interface Formatters {
  /** Hour label: `3 PM` in 12h locales, `15:00` otherwise. */
  hour(date: Date): string;
  weekday(date: Date): string;
  /** `YYYY-MM-DD` in the display time zone, for day comparisons. */
  dayKey(date: Date): string;
  number(value: number, maxDigits?: number): string;
}

export function createFormatters(
  language: string | undefined,
  locale?: HassLocale,
  serverTimeZone?: string,
): Formatters {
  const timeZone = locale?.time_zone === "server" ? serverTimeZone : undefined;
  const preference = locale?.time_format;
  const use12h =
    preference === "12"
      ? true
      : preference === "24"
        ? false
        : new Intl.DateTimeFormat(language, { hour: "numeric" }).resolvedOptions().hour12 === true;

  const hour = new Intl.DateTimeFormat(
    language,
    use12h
      ? { hour: "numeric", hour12: true, timeZone }
      : { hour: "2-digit", minute: "2-digit", hour12: false, timeZone },
  );
  const weekday = new Intl.DateTimeFormat(language, { weekday: "short", timeZone });
  const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone });
  const numbers = new Map<number, Intl.NumberFormat>();

  return {
    hour: (date) => hour.format(date),
    weekday: (date) => weekday.format(date),
    dayKey: (date) => dayKey.format(date),
    number(value, maxDigits = 0) {
      let format = numbers.get(maxDigits);
      if (!format) {
        format = new Intl.NumberFormat(language, { maximumFractionDigits: maxDigits });
        numbers.set(maxDigits, format);
      }
      return format.format(value);
    },
  };
}
