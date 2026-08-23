import * as THREE from "three";
import { CameraRig } from "../camera/CameraRig.js";
import { state } from "../state/state.js";
import { HDR_PRESETS, createEnvironmentManager } from "../../shared/environment.js";

let envManager = null;

function initializeRender() {
  const viewport = state.viewport;

  const scene = state.scene = state.scene || new THREE.Scene();

  const renderer = state.renderer = state.renderer || new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });

  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  // Configure Soft Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  viewport.appendChild(renderer.domElement);

  // Initialize Camera Rig
  const cameraRig = new CameraRig({
    scene: scene,
    domElement: renderer.domElement,
    aspect: viewport.clientWidth / viewport.clientHeight,
    fov: state.cameraSettings?.fov || 45,
    near: state.cameraSettings?.near || 0.02,
    far: state.cameraSettings?.far || 1000,
    distance: 4,
  });

  state.cameraRig = cameraRig;
  state.camera = cameraRig.camera;
  state.controls = cameraRig;

  // Default Ambient Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  state.defaultAmbientLight = ambientLight;

  // Default Directional Light
  const defaultDir = new THREE.DirectionalLight(0xffffff, 1.8);
  defaultDir.position.set(4, 6, 4);
  defaultDir.castShadow = true;
  defaultDir.shadow.mapSize.width = 1024;
  defaultDir.shadow.mapSize.height = 1024;
  defaultDir.shadow.camera.near = 0.1;
  defaultDir.shadow.camera.far = 30;
  defaultDir.shadow.bias = -0.0005;
  scene.add(defaultDir);
  state.defaultDirectionalLight = defaultDir;

  // Visual Helpers (Grid & Axes)
  const gridHelper = new THREE.GridHelper(10, 20, 0x44D62C, 0x33333b);
  gridHelper.position.y = -0.001;
  gridHelper.visible = Boolean(state.sceneSettings?.helpers?.grid !== false);
  scene.add(gridHelper);
  state.gridHelper = gridHelper;

  const axesHelper = new THREE.AxesHelper(1.5);
  axesHelper.visible = Boolean(state.sceneSettings?.helpers?.axes);
  scene.add(axesHelper);
  state.axesHelper = axesHelper;

  // Environment Manager with Texture Cache & Preloading
  envManager = createEnvironmentManager({ scene, renderer });
  state.environmentManager = envManager;

  // Load initial environment and preload remaining presets for 0ms instant switching
  const initialPreset = state.sceneSettings?.environment?.preset || "studio_small_09";
  loadEnvironment(initialPreset);
  envManager.preloadPresets();

  // Apply initial background
  applyBackgroundSettings();

  return {
    scene,
    camera: state.camera,
    renderer,
    cameraRig,
    controls: cameraRig,
  };
}

/**
 * Loads an HDR Environment by preset name or direct URL with 0ms instant cached switching
 */
function loadEnvironment(presetOrUrl) {
  if (!envManager) return;
  envManager.loadEnvironment(presetOrUrl, () => {
    applyEnvironmentParams();
    applyBackgroundSettings();
  });
}

/**
 * Applies background type, color, and blur
 */
function applyBackgroundSettings() {
  if (envManager) {
    envManager.applyBackground(state.sceneSettings);
  }
}

/**
 * Applies environment intensity, rotation, exposure, and tone mapping
 */
function applyEnvironmentParams() {
  if (!state.scene || !state.renderer) return;

  const env = state.sceneSettings?.environment || {};
  if (envManager) {
    envManager.applyToneMapping(env);
  }

  const intensity = env.intensity !== undefined ? Number(env.intensity) : 1.0;

  // Also adjust materials if model is present
  if (state.currentModel) {
    state.currentModel.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.envMapIntensity = intensity * 2.5;
      }
    });
  }
}

function setGridVisible(visible) {
  if (state.gridHelper) {
    state.gridHelper.visible = Boolean(visible);
    state.sceneSettings.helpers.grid = Boolean(visible);
  }
}

function setAxesVisible(visible) {
  if (state.axesHelper) {
    state.axesHelper.visible = Boolean(visible);
    state.sceneSettings.helpers.axes = Boolean(visible);
  }
}

function setShadowsEnabled(enabled) {
  if (state.renderer) {
    state.renderer.shadowMap.enabled = Boolean(enabled);
    state.sceneSettings.rendering.shadows = Boolean(enabled);
    state.scene?.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.needsUpdate = true;
      }
    });
  }
}

function frameModel(model = state.currentModel) {
  if (!model || !state.cameraRig) return;
  state.cameraRig.focus(model);
}

let lastRenderWidth = 0;
let lastRenderHeight = 0;

function resizeRenderer() {
  const viewport = state.viewport;
  const camera = state.camera;
  const renderer = state.renderer;
  const scene = state.scene;

  if (!viewport || !camera || !renderer) return;

  const width = viewport.clientWidth;
  const height = viewport.clientHeight;

  if (width <= 0 || height <= 0) return;

  if (width === lastRenderWidth && height === lastRenderHeight) {
    return;
  }

  lastRenderWidth = width;
  lastRenderHeight = height;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

  // Immediately render to prevent unpainted/black buffer frames
  if (scene) {
    renderer.render(scene, camera);
  }
}

function startAnimation(onFrame) {
  const step = () => {
    const controls = state.controls;
    if (controls) controls.update();

    if (typeof onFrame === "function") onFrame();

    const renderer = state.renderer;
    const scene = state.scene;
    const camera = state.camera;

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export {
  HDR_PRESETS,
  applyBackgroundSettings,
  applyEnvironmentParams,
  frameModel,
  initializeRender,
  loadEnvironment,
  resizeRenderer,
  setAxesVisible,
  setGridVisible,
  setShadowsEnabled,
  startAnimation
};
