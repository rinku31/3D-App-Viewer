/**
 * Embed Viewer Rendering Module
 * Manages Three.js scene, camera, CameraRig, WebGL renderer, and animation loop.
 */

import * as THREE from "three";
import { CameraRig } from "../../shared/CameraRig.js";
import { state } from "../state/state.js";
import { createEnvironmentManager } from "../../shared/environment.js";

/**
 * Initializes the Viewer WebGL renderer, scene, camera, and CameraRig
 */
export function initializeRender() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222228);
  state.scene = scene;

  const viewport = document.getElementById("viewport") || document.body;
  const width = viewport.clientWidth || window.innerWidth || 300;
  const height = viewport.clientHeight || window.innerHeight || 150;
  const aspect = height > 0 ? (width / height) : 1;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  viewport.appendChild(renderer.domElement);
  state.renderer = renderer;

  // Initialize shared CameraRig
  const cameraRig = new CameraRig({
    scene,
    domElement: renderer.domElement,
    aspect: aspect,
    fov: 45,
    near: 0.01,
    far: 1000,
    distance: 4.0,
    onChange: () => {
      state.visibilityDirty = true;
    }
  });

  state.cameraRig = cameraRig;
  state.camera = cameraRig.camera;

  // Environment Manager
  state.environmentManager = createEnvironmentManager({ scene, renderer });

  // Initial resize event listeners
  window.addEventListener("resize", handleResize);

  if (window.ResizeObserver && viewport) {
    const ro = new ResizeObserver(() => {
      handleResize();
    });
    ro.observe(viewport);
  }

  // Defer an initial resize check in case iframe dimensions calculate asynchronously in Firefox
  requestAnimationFrame(() => {
    handleResize();
  });

  return { scene, camera: cameraRig.camera, cameraRig, renderer };
}

/**
 * Resizes the renderer viewport and projection aspect
 */
export function handleResize() {
  if (!state.camera || !state.renderer) return;

  const viewport = document.getElementById("viewport") || document.body;
  const width = viewport.clientWidth || window.innerWidth || 300;
  const height = viewport.clientHeight || window.innerHeight || 150;

  if (width <= 0 || height <= 0) return;

  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();

  state.renderer.setSize(width, height);

  // Immediately render to prevent unpainted buffer frames
  if (state.scene) {
    state.renderer.render(state.scene, state.camera);
  }

  state.visibilityDirty = true;
}

/**
 * Applies scene background & environment settings from current scene document
 */
export function applyViewerSceneSettings() {
  if (!state.sceneDocument || !state.environmentManager) return;

  const sceneConfig = state.sceneDocument.scene || {};
  const envConfig = sceneConfig.environment || {};

  // 1. Environment ToneMapping & Exposure
  state.environmentManager.applyToneMapping(envConfig);

  // 2. Background Settings
  state.environmentManager.applyBackground(sceneConfig);

  // 3. Load Environment Preset if needed
  const preset = envConfig.preset || "studio_small_09";
  if (preset !== state.environmentManager.getCurrentPreset()) {
    state.environmentManager.loadEnvironment(preset, () => {
      state.environmentManager.applyBackground(sceneConfig);
    });
  }
}

/**
 * Starts the main requestAnimationFrame loop
 * @param {Function} onFrame - Callback executed on each tick before rendering
 */
export function startViewerLoop(onFrame) {
  function tick(timestamp) {
    requestAnimationFrame(tick);

    if (state.cameraRig) {
      state.cameraRig.update();
    }

    if (typeof onFrame === "function") {
      onFrame(timestamp);
    }

    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera);
    }
  }

  requestAnimationFrame(tick);
}
