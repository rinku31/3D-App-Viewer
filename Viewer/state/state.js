/**
 * Viewer State Singleton
 * Owns the runtime state of the 3D Viewer application.
 */

import * as THREE from "three";

export const state = {
  // Three.js & Camera instances
  scene: null,
  camera: null,
  cameraRig: null,
  renderer: null,
  raycaster: new THREE.Raycaster(),

  // Environment, Lights & Post-Processing
  environmentManager: null,
  bloomManager: null,
  bloom: {
    enabled: false,
    strength: 0.6,
    radius: 0.4,
    threshold: 0.85
  },
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
  modelInput: null,
  jsonInput: null,
  hud: null,

  // Guided Tour & Commercial HUD State
  tour: {
    active: false,
    currentStepIndex: -1,
    steps: [] // list of unified viewpoints + hotspots
  },
  isChromeHovered: false,
  inactivityTimer: null,
  inactivityThresholdMs: 3500,

  // Visibility & Animation State
  visibilityDirty: true,
  lastVisibilityUpdate: 0,
  visibilityInterval: 100,
  qualityScale: 0.85
};
