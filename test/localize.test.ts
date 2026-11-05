import { describe, expect, it } from "vitest";
import { createTranslator, resolveLanguage } from "../src/localize";

describe("localize", () => {
  it("defaults to English", () => {
    expect(createTranslator(undefined)("tabs.hourly")).toBe("Hourly");
  });
  it("uses the base language of a locale", () => {
    expect(resolveLanguage("es-ES")).toBe("es");
    expect(createTranslator("es")("tabs.hourly")).toBe("Por horas");
  });
  it("falls back to English for unknown languages and returns the key if missing", () => {
    expect(createTranslator("xx")("common.now")).toBe("Now");
    expect(createTranslator("en")("nope.missing")).toBe("nope.missing");
  });
});
