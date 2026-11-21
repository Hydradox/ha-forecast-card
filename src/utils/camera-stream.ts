const STREAM_ELEMENT = "ha-camera-stream";
const STREAM_FEATURE = 2; // CameraEntityFeature.STREAM
/** After a failed attempt, calls within this time answer false at once instead of trying again. */
export const STREAM_RETRY_MS = 60_000;

/** The camera can produce a live stream (HLS / WebRTC), not just stills. */
export function supportsStream(attributes: Record<string, unknown> | undefined): boolean {
  const features = Number(attributes?.supported_features ?? 0);
  return Number.isFinite(features) && (features & STREAM_FEATURE) !== 0;
}

interface CardHelpers {
  createCardElement(config: Record<string, unknown>): unknown;
}

let pending: Promise<boolean> | undefined;
let failedAt: number | undefined;

/**
 * `ha-camera-stream` is the player Home Assistant itself uses (HLS, WebRTC, with its own retries). The
 * frontend only loads it with the cards that need it, so build a throwaway picture-entity card to make HA
 * load it. Resolves false when it never shows up (the still image is used instead); a failure is retried,
 * at most once every `STREAM_RETRY_MS`, so a later render can still switch to the live view.
 */
export function ensureCameraStream(entity: string, timeoutMs = 4000): Promise<boolean> {
  if (customElements.get(STREAM_ELEMENT)) return Promise.resolve(true);
  if (pending) return pending;
  if (failedAt !== undefined && Date.now() - failedAt < STREAM_RETRY_MS) return Promise.resolve(false);
  pending = (async (): Promise<boolean> => {
    try {
      const loader = (window as unknown as { loadCardHelpers?: () => Promise<CardHelpers> }).loadCardHelpers;
      const helpers = await loader?.();
      helpers?.createCardElement({ type: "picture-entity", entity, camera_view: "live" });
    } catch {
      // fall through: the wait below decides
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ready = await Promise.race([
      customElements.whenDefined(STREAM_ELEMENT).then(() => true),
      new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), timeoutMs))),
    ]);
    clearTimeout(timer);
    pending = undefined;
    failedAt = ready ? undefined : Date.now();
    return ready;
  })();
  return pending;
}
