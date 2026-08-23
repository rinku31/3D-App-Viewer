/**
 * Embed Viewer State Singleton
 * Owns runtime state for the embedded 3D viewer.
 */

import * as THREE from "three";

export const state = {
  // Three.js & Camera instances
  scene: null,
  camera: null,
  cameraRig: null,
  renderer: null,
  raycaster: new THREE.Raycaster(),

  // Environment & Lights
  environmentManager: null,
  defaultAmbientLight: null,
  defaultDirectionalLight: null,
  customLights: [],

  // Loaded Assets & Scene Document
  currentModel: null,
  sceneDocument: null,
  hotspots: [],

  // DOM Elements
  container: null,
  overlay: null,
  svg: null,
  hud: null,
  envSelector: null,
  loadingOverlay: null,

  // Tour & Auto-hide Chrome State
  tour: {
    active: false,
    currentStepIndex: -1,
    steps: []
  },
  isChromeHovered: false,
  inactivityTimer: null,
  inactivityThresholdMs: 3500,

  // Visibility & Performance
  visibilityDirty: true,
  lastVisibilityUpdate: 0,
  visibilityInterval: 100,
  qualityScale: 0.85
};
