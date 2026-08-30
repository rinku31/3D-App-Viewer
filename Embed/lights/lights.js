import * as THREE from "three";
import { syncSceneLights } from "../../shared/lights.js";

export { syncSceneLights };

export function initializeViewerLights(viewerState) {
  const scene = viewerState?.scene || window.viewerInstance?.state?.scene;
  if (!scene) return;

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  if (viewerState) viewerState.defaultAmbientLight = ambient;

  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 30;
  scene.add(dir);
  if (viewerState) viewerState.defaultDirectionalLight = dir;
}

export function syncViewerLights(viewerState) {
  const stateObj = viewerState || window.viewerInstance?.state;
  if (!stateObj?.scene) return;

  const lightsData = stateObj.sceneDocument?.lights;

  if (Array.isArray(lightsData) && lightsData.length > 0) {
    if (stateObj.defaultAmbientLight) stateObj.defaultAmbientLight.visible = false;
    if (stateObj.defaultDirectionalLight) stateObj.defaultDirectionalLight.visible = false;

    stateObj.customLights = syncSceneLights(stateObj.scene, lightsData, stateObj.customLights);
  } else {
    if (stateObj.defaultAmbientLight) stateObj.defaultAmbientLight.visible = true;
    if (stateObj.defaultDirectionalLight) stateObj.defaultDirectionalLight.visible = true;

    stateObj.customLights = syncSceneLights(stateObj.scene, [], stateObj.customLights);
  }
}
