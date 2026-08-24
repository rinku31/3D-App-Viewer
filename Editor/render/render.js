import * as THREE from "three";
import { CameraRig } from "../camera/CameraRig.js";
import { state } from "../state/state.js";
import { HDR_PRESETS, createEnvironmentManager } from "../../shared/environment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// Initialize uniform library for Blender-style RectAreaLights
try {
  RectAreaLightUniformsLib.init();
} catch (err) {
  console.warn("RectAreaLightUniformsLib init error:", err);
}

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

  // Blender 4.0+ AgX Color Management by default
  renderer.toneMapping = THREE.AgXToneMapping || THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = state.sceneSettings?.environment?.exposure !== undefined 
    ? Number(state.sceneSettings.environment.exposure) 
    : 1.0; // 0.0 EV

  // Configure Soft Contact Shadows
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

  // In Blender Cycles, World Environment (IBL) provides diffuse & specular radiance;
  // AmbientLight is set to 0 to prevent flattening physical contrast
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.0);
  scene.add(ambientLight);
  state.defaultAmbientLight = ambientLight;

  // Default Key Directional (Sun) Light with tight contact shadow bias
  const defaultDir = new THREE.DirectionalLight(0xfffdf5, 2.5);
  defaultDir.position.set(3.5, 5.0, 3.5);
  defaultDir.castShadow = true;
  defaultDir.shadow.mapSize.width = 2048;
  defaultDir.shadow.mapSize.height = 2048;
  defaultDir.shadow.camera.near = 0.1;
  defaultDir.shadow.camera.far = 40;
  defaultDir.shadow.bias = -0.0001;
  defaultDir.shadow.normalBias = 0.02; // Critical for smooth contact shadows without acne
  defaultDir.shadow.radius = 2.0;     // Soft penumbra
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
 * Tight-fit directional shadow camera to model bounding sphere for maximum shadow resolution
 */
function fitDirectionalShadowCamera(light = state.defaultDirectionalLight, model = state.currentModel) {
  if (!light || !light.shadow || !light.shadow.camera || !model) return;
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(0.5, sphere.radius);
  const padding = radius * 1.5;

  light.shadow.camera.left = -padding;
  light.shadow.camera.right = padding;
  light.shadow.camera.top = padding;
  light.shadow.camera.bottom = -padding;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = Math.max(20, sphere.center.distanceTo(light.position) + radius * 3);
  light.shadow.camera.updateProjectionMatrix();
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

  // Exact 1.0 multiplier matching Blender Cycles World Background Strength
  if (state.currentModel) {
    state.currentModel.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.envMapIntensity = intensity;
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
  fitDirectionalShadowCamera,
  frameModel,
  initializeRender,
  loadEnvironment,
  resizeRenderer,
  setAxesVisible,
  setGridVisible,
  setShadowsEnabled,
  startAnimation
};
