import * as THREE from "three";
import { CameraRig } from "../../shared/CameraRig.js";
import { createEnvironmentManager } from "../../shared/environment.js";
import { createBloomManager } from "../../shared/bloom.js";
import { applyViewerSceneSettings } from "../../shared/viewerLoader.js";

export { applyViewerSceneSettings };

export function initializeRender(viewerState) {
  const stateObj = viewerState || window.viewerInstance?.state;
  if (!stateObj) return;

  const viewport = stateObj.viewport || document.getElementById("viewport") || document.body;
  const width = viewport.clientWidth || window.innerWidth;
  const height = viewport.clientHeight || window.innerHeight;

  if (!stateObj.renderer) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    viewport.appendChild(renderer.domElement);
    stateObj.renderer = renderer;
  }

  if (!stateObj.cameraRig) {
    const cameraRig = new CameraRig(stateObj.renderer.domElement, {
      fov: 45,
      near: 0.1,
      far: 2000,
      initialRadius: 5,
      damping: 0.08,
      antiClipping: true
    });
    stateObj.cameraRig = cameraRig;
    stateObj.camera = cameraRig.camera;
  }

  if (!stateObj.environmentManager) {
    stateObj.environmentManager = createEnvironmentManager(stateObj.scene, stateObj.renderer);
  }

  if (!stateObj.bloomManager) {
    stateObj.bloomManager = createBloomManager(stateObj.renderer, stateObj.scene, stateObj.camera);
  }
}

export function startViewerLoop(callback) {
  // Driven by viewerCore render loop
}
