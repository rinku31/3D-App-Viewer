import { testHotspotOcclusion } from "../../shared/hotspotMath.js";

export { testHotspotOcclusion };

export function updateHotspotVisibility(viewerState, force = false) {
  const stateObj = viewerState || window.viewerInstance?.state;
  if (!stateObj?.sceneDocument || !stateObj?.camera || !stateObj?.currentModel || !stateObj?.hotspots?.length) {
    return;
  }

  const now = performance.now();
  if (!force && now - stateObj.lastVisibilityUpdate < stateObj.visibilityInterval) {
    return;
  }

  stateObj.lastVisibilityUpdate = now;
  stateObj.visibilityDirty = false;

  const tolerance = stateObj.sceneDocument.settings?.hotspots?.occlusionTolerance ?? 0.08;

  stateObj.hotspots.forEach((h) => {
    if (!h.position) return;
    const isVisible = testHotspotOcclusion(
      h.position,
      stateObj.camera,
      stateObj.currentModel,
      stateObj.raycaster,
      tolerance
    );
    h.visible = isVisible;
  });
}
