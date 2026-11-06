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
