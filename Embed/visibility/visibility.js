/**
 * Embed Viewer Visibility Module
 * Throttled occlusion testing against model geometry using shared hotspotMath.
 */

import { state } from "../state/state.js";
import { testHotspotOcclusion } from "../../shared/hotspotMath.js";

/**
 * Updates the visibility status of all active hotspots.
 */
export function updateHotspotVisibility(force = false) {
  if (!state.sceneDocument || !state.camera) return;

  const now = performance.now();
  if (!force && !state.visibilityDirty && now - state.lastVisibilityUpdate < state.visibilityInterval) {
    return;
  }

  state.lastVisibilityUpdate = now;
  state.visibilityDirty = false;

  const tolerance = state.sceneDocument.settings?.hotspots?.occlusionTolerance ?? 0.08;

  state.hotspots.forEach((h) => {
    if (!h.position) return;

    const isVisible = testHotspotOcclusion(
      h.position,
      state.camera,
      state.currentModel,
      state.raycaster,
      tolerance
    );

    h.visible = isVisible;
  });
}
