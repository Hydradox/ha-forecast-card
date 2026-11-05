/** Minimal subset of the Home Assistant frontend types used by this card. */

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HassConfig {
  unit_system: Record<string, string>;
  time_zone: string;
}

export interface HassLocale {
  language: string;
  number_format?: string;
  time_format?: string;
  date_format?: string;
  time_zone?: string;
}

export interface HassConnection {
  subscribeMessage<T>(
    callback: (message: T) => void,
    subscribeMessage: Record<string, unknown>,
    options?: { resubscribe?: boolean },
  ): Promise<() => Promise<void> | void>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity | undefined>;
  config: HassConfig;
  language: string;
  locale: HassLocale;
  connection: HassConnection;
  themes?: { darkMode?: boolean };
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: unknown): void;
  getCardSize?(): number | Promise<number>;
  getGridOptions?(): GridOptions;
}

export interface GridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  min_columns?: number;
  min_rows?: number;
  max_columns?: number;
  max_rows?: number;
}

export interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}
