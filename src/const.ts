export const CARD_TYPE = "ha-forecast-card";
export const CARD_TAG = CARD_TYPE;
export const EDITOR_TAG = `${CARD_TYPE}-editor`;
export const DEFAULT_LANGUAGE = "en";

/**
 * Window event the editor fires so a card showing the same places follows the place being edited
 * (HA gives the preview card nothing but the config). `detail`: `{ index, signature }`.
 */
export const PREVIEW_EVENT = `${CARD_TYPE}:preview-location`;

/** Identifies a list of places across editor and card: their entities, in order. */
export const placesSignature = (entities: readonly unknown[]): string => entities.join("|");

export interface PreviewLocationDetail {
  index: number;
  signature: string;
}
