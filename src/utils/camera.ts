import type { HassEntity } from "../types/ha";

export type CameraLayout = "tab" | "strip";

export const CAMERA_LAYOUTS: readonly CameraLayout[] = ["tab", "strip"];

export interface CameraSourceConfig {
  camera_entity?: string;
}

/** The camera block only exists when a camera entity or an image URL is configured. */
export function hasCamera(config: CameraSourceConfig): boolean {
  return !!(config.camera_entity);
}

/** Adds a changing query parameter so the browser fetches a new frame instead of reusing the cached one. */
export function withStamp(url: string, stamp: number): string {
  const hash = url.indexOf("#");
  const base = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? "" : url.slice(hash);
  return `${base}${base.includes("?") ? "&" : "?"}_hfc=${stamp}${fragment}`;
}

export interface CameraFrame {
  /** Image to show, or undefined when the camera cannot be shown right now. */
  url?: string;
  name?: string;
  /** Entity to open on tap (live view in more-info). */
  entity?: string;
}

/** The camera entity's still (`entity_picture`, which carries an access token HA rotates), if it is available. */
export function cameraFrame(
  config: CameraSourceConfig & { camera_name?: string },
  state: HassEntity | undefined,
  stamp: number,
  resolve: (path: string) => string = (path) => path,
): CameraFrame {
  const name = config.camera_name || (state?.attributes.friendly_name as string | undefined);
  const entity = config.camera_entity;
  const picture = state?.attributes.entity_picture;
  if (entity && state && state.state !== "unavailable" && typeof picture === "string" && picture) {
    return { url: withStamp(resolve(picture), stamp), name, entity };
  }
  return { name, entity };
}
