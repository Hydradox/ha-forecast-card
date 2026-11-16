import type { TemplateResult } from "lit";
import { html, nothing, svg } from "lit";
import type { Translate } from "../localize";
import type { CameraFrame } from "../utils/camera";
import type { HassEntity, HomeAssistant } from "../types/ha";

const cameraIcon = svg`<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h3l1.5-2h7L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.500 18V9A1.5 1.5 0 0 1 4 7.500z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;

const chevron = svg`<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

interface CameraView {
  frame: CameraFrame;
  label: string;
  /** The frame at `frame.url` failed to load. */
  failed: boolean;
  onLoad: () => void;
  onError: (url: string) => void;
  localize: Translate;
  /** Set while the live stream should play instead of the still. */
  stream?: { hass: HomeAssistant; stateObj: HassEntity };
}

function renderImage(view: CameraView): TemplateResult {
  const { frame, failed } = view;
  const shown = frame.url !== undefined && !failed;
  return html`
    ${view.stream
      ? html`<div class="cam-live">
          <ha-camera-stream .hass=${view.stream.hass} .stateObj=${view.stream.stateObj} .controls=${false} muted playsinline></ha-camera-stream>
        </div>`
      : shown
      ? html`<img
          src=${frame.url!}
          alt=""
          draggable="false"
          referrerpolicy="no-referrer"
          @load=${view.onLoad}
          @error=${() => view.onError(frame.url!)}
        />`
      : html`<span class="cam-empty">${view.localize("camera.unavailable")}</span>`}
    <span class="cam-shade"></span>
    <span class="cam-label">${cameraIcon}<span>${view.label}</span></span>
  `;
}

/** Camera as a tab panel (layout `tab`): opens the live view when tapped. */
export function renderCameraPanel(view: CameraView & { onOpen?: () => void }): TemplateResult {
  const content = renderImage(view);
  return view.onOpen
    ? html`<button type="button" class="cam cam-panel" aria-label=${view.localize("camera.open", { name: view.label })} @click=${view.onOpen}>
        ${content}
      </button>`
    : html`<div class="cam cam-panel" role="img" aria-label=${view.label}>${content}</div>`;
}

/**
 * Camera as a strip under the header (layout `strip`). Collapsed, tapping it expands it; expanded, tapping
 * the image runs the camera action (big view) and the chevron button collapses it.
 */
export function renderCameraStrip(view: CameraView & { open: boolean; onToggle: () => void; onOpen?: () => void }): TemplateResult {
  const act = view.open && view.onOpen ? view.onOpen : view.onToggle;
  const label = view.open && view.onOpen ? "camera.open" : "camera.expand";
  return html`<div class="cam cam-strip" data-open=${view.open ? "" : nothing}>
    ${renderImage(view)}
    <button type="button" class="cam-hit" aria-label=${view.localize(label, { name: view.label })} @click=${act}></button>
    <button
      type="button"
      class="cam-chevron"
      aria-expanded=${view.open}
      aria-label=${view.localize(view.open ? "camera.collapse" : "camera.expand", { name: view.label })}
      @click=${view.onToggle}
    >
      ${chevron}
    </button>
  </div>`;
}
