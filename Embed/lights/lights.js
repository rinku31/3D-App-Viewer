/**
 * Embed Viewer Lights Module
 * Manages presentation lights and custom lights defined in Scene JSON documents.
 */

import * as THREE from "three";
import { state } from "../state/state.js";
import { syncSceneLights } from "../shared/lights.js";

/**
 * Initializes default ambient & directional lighting for the viewer
 */
export function initializeViewerLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  state.scene.add(ambient);
  state.defaultAmbientLight = ambient;

  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 30;
  dir.shadow.bias = -0.0001;
  dir.shadow.normalBias = 0.02;
  dir.shadow.radius = 2.0;
  state.scene.add(dir);
  state.defaultDirectionalLight = dir;
}

/**
 * Synchronizes lights in the scene with the current scene document
 */
export function syncViewerLights() {
  if (!state.scene) return;

  const lightsData = state.sceneDocument?.lights;

  if (Array.isArray(lightsData) && lightsData.length > 0) {
    // Hide default lights when custom lights are authored
    if (state.defaultAmbientLight) state.defaultAmbientLight.visible = false;
    if (state.defaultDirectionalLight) state.defaultDirectionalLight.visible = false;

    state.customLights = syncSceneLights(state.scene, lightsData, state.customLights);
  } else {
    // Show default lights
    if (state.defaultAmbientLight) state.defaultAmbientLight.visible = true;
    if (state.defaultDirectionalLight) state.defaultDirectionalLight.visible = true;

    // Clear custom lights if any
    state.customLights = syncSceneLights(state.scene, [], state.customLights);
  }
}
