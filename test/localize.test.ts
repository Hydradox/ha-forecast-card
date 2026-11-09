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
  it("resolves Dutch locales", () => {
    expect(resolveLanguage("nl-BE")).toBe("nl");
    expect(createTranslator("nl")("tabs.daily")).toBe("Per dag");
  });
  it("resolves German locales", () => {
    expect(resolveLanguage("de-AT")).toBe("de");
    expect(createTranslator("de")("tabs.daily")).toBe("Täglich");
  });
  it("resolves French locales", () => {
    expect(resolveLanguage("fr-CA")).toBe("fr");
    expect(createTranslator("fr")("tabs.daily")).toBe("Par jour");
  });
  it("resolves Italian locales", () => {
    expect(resolveLanguage("it-CH")).toBe("it");
    expect(createTranslator("it")("tabs.daily")).toBe("Giornaliero");
  });
  it("resolves Polish locales", () => {
    expect(resolveLanguage("pl-PL")).toBe("pl");
    expect(createTranslator("pl")("tabs.daily")).toBe("Dzienna");
  });
  it("resolves Swedish locales", () => {
    expect(resolveLanguage("sv-FI")).toBe("sv");
    expect(createTranslator("sv")("tabs.daily")).toBe("Per dag");
  });
  it("resolves Danish locales", () => {
    expect(resolveLanguage("da-DK")).toBe("da");
    expect(createTranslator("da")("tabs.daily")).toBe("Pr. dag");
  });
  it("resolves Norwegian locales (nb, no)", () => {
    expect(resolveLanguage("nb-NO")).toBe("nb");
    expect(resolveLanguage("no")).toBe("no");
    expect(createTranslator("no")("tabs.daily")).toBe("Per dag");
    expect(createTranslator("nb")("tabs.daily")).toBe("Per dag");
  });
  it("resolves Portuguese locales", () => {
    expect(resolveLanguage("pt-BR")).toBe("pt");
    expect(createTranslator("pt")("tabs.daily")).toBe("Por dia");
  });
  it("falls back to English for unknown languages and returns the key if missing", () => {
    expect(createTranslator("xx")("common.now")).toBe("Now");
    expect(createTranslator("en")("nope.missing")).toBe("nope.missing");
  });
});

describe("condition names", () => {
  it("ships every HA weather condition in every language", async () => {
    const { createTranslator } = await import("../src/localize");
    for (const language of ["en", "es", "fr", "de", "it", "pt", "nl", "da", "nb", "sv", "pl"]) {
      const t = createTranslator(language);
      for (const c of ["clear-night", "cloudy", "exceptional", "fog", "hail", "lightning", "lightning-rainy", "partlycloudy", "pouring", "rainy", "snowy", "snowy-rainy", "sunny", "windy", "windy-variant"]) {
        expect(t(`conditions.${c}`), `${language}/${c}`).not.toBe(`conditions.${c}`);
      }
    }
    expect(createTranslator("es")("conditions.sunny")).toBe("Soleado");
  });
});

describe("festivity names", () => {
  it("ships every festivity in every language", async () => {
    const { createTranslator } = await import("../src/localize");
    for (const language of ["en", "es", "fr", "de", "it", "pt", "nl", "da", "nb", "sv", "pl"]) {
      const t = createTranslator(language);
      for (const id of ["auto", "none", "halloween", "christmas", "new_year", "epiphany", "valentine", "carnival", "fallas", "easter"]) {
        expect(t(`festivities.${id}`), `${language}/${id}`).not.toBe(`festivities.${id}`);
      }
      expect(t("editor.festivity"), language).not.toBe("editor.festivity");
    }
  });
});
