import { DEFAULT_LANGUAGE } from "../const";
import en from "./translations/en.json";
import es from "./translations/es.json";

type Dictionary = { [key: string]: string | Dictionary };

/** Register a new language by adding its JSON file here. English is the fallback. */
const DICTIONARIES: Record<string, Dictionary> = { en, es };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** `es-ES` → `es`; unknown languages fall back to English. */
export function resolveLanguage(language: string | undefined): string {
  const base = (language ?? DEFAULT_LANGUAGE).toLowerCase().split(/[-_]/)[0];
  return base in DICTIONARIES ? base : DEFAULT_LANGUAGE;
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function createTranslator(language: string | undefined): Translate {
  const primary = DICTIONARIES[resolveLanguage(language)];
  const fallback = DICTIONARIES[DEFAULT_LANGUAGE];
  return (key, vars) => {
    const text = lookup(primary, key) ?? lookup(fallback, key) ?? key;
    return vars
      ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match))
      : text;
  };
}
