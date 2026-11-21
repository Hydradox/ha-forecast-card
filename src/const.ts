export const CARD_TYPE = "ha-forecast-card";
export const CARD_TAG = CARD_TYPE;
export const EDITOR_TAG = `${CARD_TYPE}-editor`;
export const DEFAULT_LANGUAGE = "en";

/**
 * Window event the editor fires so the preview card next to it follows the place being edited
 * (HA gives the preview card nothing but the config). `detail`: `{ index, signature, source }`.
 */
export const PREVIEW_EVENT = `${CARD_TYPE}:preview-location`;

/** Identifies a list of places across editor and card: their entities, in order. */
export const placesSignature = (entities: readonly unknown[]): string => entities.join("|");

export interface PreviewLocationDetail {
  index: number;
  signature: string;
  /** The editor that sent it: only a card in the same dialog follows. */
  source?: Element;
}
