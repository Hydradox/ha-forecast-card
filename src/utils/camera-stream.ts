const STREAM_ELEMENT = "ha-camera-stream";
const STREAM_FEATURE = 2; // CameraEntityFeature.STREAM

/** The camera can produce a live stream (HLS / WebRTC), not just stills. */
export function supportsStream(attributes: Record<string, unknown> | undefined): boolean {
  const features = Number(attributes?.supported_features ?? 0);
  return Number.isFinite(features) && (features & STREAM_FEATURE) !== 0;
}

interface CardHelpers {
  createCardElement(config: Record<string, unknown>): unknown;
}

let pending: Promise<boolean> | undefined;

/**
 * `ha-camera-stream` is the player Home Assistant itself uses (HLS, WebRTC, with its own retries). The
 * frontend only loads it with the cards that need it, so build a throwaway picture-entity card once to make
 * HA load it. Resolves false when it never shows up (the still image is used instead).
 */
export function ensureCameraStream(entity: string, timeoutMs = 4000): Promise<boolean> {
  if (customElements.get(STREAM_ELEMENT)) return Promise.resolve(true);
  pending ??= (async () => {
    try {
      const loader = (window as unknown as { loadCardHelpers?: () => Promise<CardHelpers> }).loadCardHelpers;
      const helpers = await loader?.();
      helpers?.createCardElement({ type: "picture-entity", entity, camera_view: "live" });
    } catch {
      // fall through: the wait below decides
    }
    return Promise.race([
      customElements.whenDefined(STREAM_ELEMENT).then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
  })();
  return pending;
}
