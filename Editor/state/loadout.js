import * as THREE from "three";
import { state, notifySelectionChanged } from "./state.js";
import {
  clearAllLights,
  createAmbientLight,
  createAreaLight,
  createDirectionalLight,
  createPointLight,
  createSpotLight,
  setLightVisibility
} from "../lights/lights.js";
import {
  applyBackgroundSettings,
  applyBloomSettings,
  applyEnvironmentParams,
  loadEnvironment,
  setAxesVisible,
  setGridVisible,
  setShadowsEnabled
} from "../render/render.js";
import { applyGlobalHotspotSettings } from "../inspector/inspector.js";

export const STARTUP_LOADOUT_STORAGE_KEY = "web3d_editor_startup_loadout_v1";

/**
 * Standard factory defaults for the startup loadout.
 * Based on existing editor defaults.
 */
export const FACTORY_DEFAULT_LOADOUT = {
  version: "1.0.0",
  name: "Factory Default Loadout",
  updatedAt: "2026-01-01T00:00:00.000Z",
  environment: {
    preset: "studio_small_09",
    customHdrUrl: null,
    intensity: 1.0,
    rotation: 0.0,
    exposure: 1.0,
    exposureEV: 0.0,
    toneMapping: "AgX",
    look: "None"
  },
  editorBackground: {
    type: "color",
    color: "#222228",
    blur: 0.0
  },
  background: {
    type: "color",
    color: "#222228",
    blur: 0.0
  },
  rendering: {
    shadows: true,
    shadowType: "pcfsoft",
    contactShadows: true,
    shadowSoftness: 2.0,
    blenderCyclesMode: true
  },
  bloom: {
    enabled: false,
    strength: 0.6,
    radius: 0.4,
    threshold: 0.85
  },
  helpers: {
    grid: true,
    axes: false
  },
  lights: [],
  hotspots: {
    panelColor: "rgba(30, 30, 36, 0.95)",
    titleFontColor: "#ffffff",
    titleFontSize: 14,
    descFontColor: "#e0e0e0",
    descFontSize: 12.5,
    listFontColor: "#cccccc",
    listFontSize: 11,
    btnFontColor: "#ffffff",
    btnFontSize: 11,
    btnBgColor: "rgba(68, 214, 44, 0.28)",
    btnPaddingV: 5,
    btnPaddingH: 12,
    btnMargin: 5,
    pulseAnimation: true,
    theme: "default",
    occlusionTolerance: 0.08
  },
  line: {
    color: "#44D62C",
    style: "dashed",
    width: 1.5,
    offset: { x: 0, y: 0 }
  },
  controls: {
    defaultEnabled: true,
    explodeEnabled: true,
    simulatorEnabled: true,
    simulatorJsFunction: "onSimulatorToggle",
    simulatorUrl: ""
  },
  camera: {
    fov: 45,
    near: 0.01,
    far: 1000,
    minDistance: 1.35,
    maxDistance: 16.0,
    minPitch: -82,
    maxPitch: 82,
    autoRotate: false
  },
  gizmo: {
    mode: "translate",
    space: "world",
    snap: false,
    visible: true
  }
};

/**
 * Gets saved startup loadout from localStorage, or null if none saved.
 */
export function getStoredLoadout() {
  try {
    const raw = localStorage.getItem(STARTUP_LOADOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    console.warn("[Loadout] Failed to read startup loadout from localStorage:", err);
  }
  return null;
}

/**
 * Checks if a custom startup loadout is saved.
 */
export function hasCustomLoadout() {
  return getStoredLoadout() !== null;
}

/**
 * Captures the current editor scene state as a structured loadout object.
 */
export function captureCurrentLoadout() {
  const env = state.sceneSettings?.environment || {};
  const rendering = state.sceneSettings?.rendering || {};
  const bloom = state.sceneSettings?.bloom || {};
  const helpers = state.sceneSettings?.helpers || {};
  const hotspots = state.sceneSettings?.hotspots || {};
  const line = state.sceneSettings?.line || {};
  const controls = state.sceneSettings?.controls || {};

  const minPitch = typeof state.cameraRig?.getMinPitchDeg === "function"
    ? state.cameraRig.getMinPitchDeg()
    : (typeof state.cameraSettings?.minPitch === "number" ? state.cameraSettings.minPitch : -82);

  const maxPitch = typeof state.cameraRig?.getMaxPitchDeg === "function"
    ? state.cameraRig.getMaxPitchDeg()
    : (typeof state.cameraSettings?.maxPitch === "number" ? state.cameraSettings.maxPitch : 82);

  const minDistance = typeof state.cameraRig?.minDistance === "number"
    ? state.cameraRig.minDistance
    : (typeof state.cameraSettings?.minDistance === "number" ? state.cameraSettings.minDistance : 1.35);

  const maxDistance = typeof state.cameraRig?.maxDistance === "number"
    ? state.cameraRig.maxDistance
    : (typeof state.cameraSettings?.maxDistance === "number" ? state.cameraSettings.maxDistance : 16.0);

  const lights = state.lights.map((l) => {
    const rawType = (l.type || "directional").toLowerCase();
    let type = "directional";
    if (rawType.includes("point")) type = "point";
    else if (rawType.includes("spot")) type = "spot";
    else if (rawType.includes("area") || rawType.includes("rect")) type = "area";
    else if (rawType.includes("ambient")) type = "ambient";

    const entry = {
      id: l.id,
      name: l.name || (type === "area" ? "Area Softbox" : `${type.charAt(0).toUpperCase() + type.slice(1)} Light`),
      type: type,
      color: l.color || "#ffffff",
      intensity: typeof l.intensity === "number" ? l.intensity : (type === "area" ? 15.0 : 2.0),
      castShadow: Boolean(l.castShadow),
      visible: Boolean(l.visible !== false),
      locked: Boolean(l.locked)
    };

    if (l.light?.position) {
      entry.position = [l.light.position.x, l.light.position.y, l.light.position.z];
    } else if (Array.isArray(l.position)) {
      entry.position = [...l.position];
    }

    if (l.target?.position) {
      entry.target = [l.target.position.x, l.target.position.y, l.target.position.z];
    } else if (Array.isArray(l.target)) {
      entry.target = [...l.target];
    }

    if (type === "area") {
      entry.width = typeof l.width === "number" ? l.width : (l.light?.width !== undefined ? Number(l.light.width) : 2.5);
      entry.height = typeof l.height === "number" ? l.height : (l.light?.height !== undefined ? Number(l.light.height) : 2.5);
    }
    if (type === "point" || type === "spot") {
      if (l.distance !== undefined) entry.distance = l.distance;
      if (l.decay !== undefined) entry.decay = l.decay;
    }
    if (type === "spot") {
      if (l.angle !== undefined) entry.angle = l.angle;
      if (l.penumbra !== undefined) entry.penumbra = l.penumbra;
    }
    if (type !== "ambient" && type !== "area") {
      if (l.radius !== undefined) entry.radius = l.radius;
    }

    return entry;
  });

  return {
    version: "1.0.0",
    name: "Custom Startup Loadout",
    updatedAt: new Date().toISOString(),
    environment: {
      preset: env.preset || "studio_small_09",
      customHdrUrl: env.customHdrUrl || null,
      intensity: typeof env.intensity === "number" ? env.intensity : 1.0,
      rotation: typeof env.rotation === "number" ? env.rotation : 0.0,
      exposure: typeof env.exposure === "number" ? env.exposure : 1.0,
      exposureEV: typeof env.exposureEV === "number" ? env.exposureEV : 0.0,
      toneMapping: env.toneMapping || "AgX",
      look: env.look || "None"
    },
    editorBackground: {
      type: state.editorBackground?.type || "color",
      color: state.editorBackground?.color || "#222228",
      blur: typeof state.editorBackground?.blur === "number" ? state.editorBackground.blur : 0.0
    },
    background: {
      type: state.editorBackground?.type || "color",
      color: state.editorBackground?.color || "#222228",
      blur: typeof state.editorBackground?.blur === "number" ? state.editorBackground.blur : 0.0
    },
    rendering: {
      shadows: rendering.shadows !== false,
      shadowType: rendering.shadowType || "pcfsoft",
      contactShadows: rendering.contactShadows !== false,
      shadowSoftness: typeof rendering.shadowSoftness === "number" ? rendering.shadowSoftness : 2.0,
      blenderCyclesMode: rendering.blenderCyclesMode !== false
    },
    bloom: {
      enabled: Boolean(bloom.enabled),
      strength: typeof bloom.strength === "number" ? bloom.strength : 0.6,
      radius: typeof bloom.radius === "number" ? bloom.radius : 0.4,
      threshold: typeof bloom.threshold === "number" ? bloom.threshold : 0.85
    },
    helpers: {
      grid: helpers.grid !== false,
      axes: Boolean(helpers.axes)
    },
    lights: lights,
    hotspots: {
      panelColor: hotspots.panelColor || "rgba(30, 30, 36, 0.95)",
      titleFontColor: hotspots.titleFontColor || "#ffffff",
      titleFontSize: Number(hotspots.titleFontSize || 14),
      descFontColor: hotspots.descFontColor || "#e0e0e0",
      descFontSize: Number(hotspots.descFontSize || 12.5),
      listFontColor: hotspots.listFontColor || "#cccccc",
      listFontSize: Number(hotspots.listFontSize || 11),
      btnFontColor: hotspots.btnFontColor || "#ffffff",
      btnFontSize: Number(hotspots.btnFontSize || 11),
      btnBgColor: hotspots.btnBgColor || "rgba(68, 214, 44, 0.28)",
      btnPaddingV: Number(hotspots.btnPaddingV || 5),
      btnPaddingH: Number(hotspots.btnPaddingH || 12),
      btnMargin: Number(hotspots.btnMargin || 5),
      pulseAnimation: hotspots.pulseAnimation !== false,
      theme: hotspots.theme || "default",
      occlusionTolerance: typeof hotspots.occlusionTolerance === "number" ? hotspots.occlusionTolerance : 0.08
    },
    line: {
      color: line.color || "#44D62C",
      style: line.style || "dashed",
      width: typeof line.width === "number" ? line.width : 1.5,
      offset: line.offset || { x: 0, y: 0 }
    },
    controls: {
      defaultEnabled: controls.defaultEnabled !== false,
      explodeEnabled: controls.explodeEnabled !== false,
      simulatorEnabled: controls.simulatorEnabled !== false,
      simulatorJsFunction: controls.simulatorJsFunction || "onSimulatorToggle",
      simulatorUrl: controls.simulatorUrl || ""
    },
    camera: {
      fov: state.camera?.fov || 45,
      near: state.camera?.near || 0.01,
      far: state.camera?.far || 1000,
      minDistance: Number(minDistance),
      maxDistance: Number(maxDistance),
      minPitch: Number(minPitch),
      maxPitch: Number(maxPitch),
      autoRotate: Boolean(state.cameraRig?.autoRotate)
    },
    gizmo: {
      mode: state.gizmo?.mode || "translate",
      space: state.gizmo?.space || "world",
      snap: Boolean(state.gizmo?.snap),
      visible: state.gizmo?.visible !== false
    }
  };
}

/**
 * Saves current scene settings as the default startup loadout in localStorage.
 */
export function saveCurrentAsDefaultLoadout() {
  const loadout = captureCurrentLoadout();
  try {
    localStorage.setItem(STARTUP_LOADOUT_STORAGE_KEY, JSON.stringify(loadout));
    console.info("[Loadout] Saved default startup loadout to local storage:", loadout);
    return loadout;
  } catch (err) {
    console.error("[Loadout] Failed to save loadout to localStorage:", err);
    throw err;
  }
}

/**
 * Removes the saved default loadout from localStorage.
 */
export function resetDefaultLoadout() {
  try {
    localStorage.removeItem(STARTUP_LOADOUT_STORAGE_KEY);
    console.info("[Loadout] Cleared custom startup loadout from local storage.");
  } catch (err) {
    console.warn("[Loadout] Error clearing loadout from localStorage:", err);
  }
}

/**
 * Applies a loadout object to the active editor session and synchronizes all subsystems.
 * @param {object} loadout
 * @param {object} syncOptions - { syncUI: true, notify: true }
 */
export function applyLoadout(loadout, syncOptions = {}) {
  if (!loadout || typeof loadout !== "object") return;

  const { syncUI = true, notify = true } = syncOptions;

  // 1. Environment & Background
  if (!state.sceneSettings) state.sceneSettings = {};
  if (!state.sceneSettings.environment) state.sceneSettings.environment = {};

  if (loadout.environment) {
    Object.assign(state.sceneSettings.environment, loadout.environment);
    if (loadout.environment.preset) {
      loadEnvironment(loadout.environment.preset);
    }
    applyEnvironmentParams();
  }

  const editorBgLoadout = loadout.editorBackground || loadout.background;
  if (editorBgLoadout) {
    if (!state.editorBackground) state.editorBackground = {};
    state.editorBackground.type = editorBgLoadout.type || "color";
    state.editorBackground.color = editorBgLoadout.color || "#222228";
    state.editorBackground.blur = editorBgLoadout.blur ?? 0.0;
    applyBackgroundSettings();
    
    if (syncUI) {
      const typeSelect = document.getElementById("envTabEditorBgType");
      if (typeSelect) {
        typeSelect.value = state.editorBackground.type;
        const colorRow = document.getElementById("envTabEditorBgColorRow");
        const blurRow = document.getElementById("envTabEditorBgBlurRow");
        if (colorRow) colorRow.style.display = state.editorBackground.type === "transparent" ? "none" : "flex";
        if (blurRow) blurRow.style.display = state.editorBackground.type === "environment" ? "block" : "none";
      }
      const colorInput = document.getElementById("envTabEditorBgColor");
      const colorText = document.getElementById("envTabEditorBgColorText");
      if (colorInput) colorInput.value = state.editorBackground.color;
      if (colorText) colorText.value = state.editorBackground.color;
      
      const blurInput = document.getElementById("envTabEditorBgBlur");
      const blurVal = document.getElementById("envTabEditorBgBlurVal");
      if (blurInput) blurInput.value = state.editorBackground.blur;
      if (blurVal) blurVal.textContent = state.editorBackground.blur.toFixed(2);
    }
  }

  // 2. Rendering & Post-Processing
  if (loadout.rendering) {
    if (!state.sceneSettings.rendering) state.sceneSettings.rendering = {};
    Object.assign(state.sceneSettings.rendering, loadout.rendering);
    setShadowsEnabled(loadout.rendering.shadows !== false);
  }

  if (loadout.bloom) {
    if (!state.sceneSettings.bloom) state.sceneSettings.bloom = {};
    Object.assign(state.sceneSettings.bloom, loadout.bloom);
    applyBloomSettings(loadout.bloom);
  }

  if (loadout.helpers) {
    if (!state.sceneSettings.helpers) state.sceneSettings.helpers = {};
    Object.assign(state.sceneSettings.helpers, loadout.helpers);
    setGridVisible(loadout.helpers.grid !== false);
    setAxesVisible(Boolean(loadout.helpers.axes));
  }

  // 3. Hotspots & Line Styling
  if (loadout.hotspots) {
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    Object.assign(state.sceneSettings.hotspots, loadout.hotspots);
  }

  if (loadout.line) {
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    Object.assign(state.sceneSettings.line, loadout.line);
  }

  if (loadout.controls) {
    if (!state.sceneSettings.controls) state.sceneSettings.controls = {};
    Object.assign(state.sceneSettings.controls, loadout.controls);
  }

  applyGlobalHotspotSettings();

  // 4. Lights
  if (Array.isArray(loadout.lights) && loadout.lights.length > 0) {
    clearAllLights();
    loadout.lights.forEach((l) => {
      const typeLower = String(l.type || "directional").toLowerCase();
      if (typeLower.includes("point")) {
        createPointLight({ ...l, select: false });
      } else if (typeLower.includes("spot")) {
        createSpotLight({ ...l, select: false });
      } else if (typeLower.includes("area") || typeLower.includes("rect")) {
        createAreaLight({ ...l, select: false });
      } else if (typeLower.includes("ambient")) {
        createAmbientLight({ ...l, select: false });
      } else {
        createDirectionalLight({ ...l, select: false });
      }

      const newLight = state.lights[state.lights.length - 1];
      if (newLight) {
        newLight.locked = Boolean(l.locked);
        if (l.visible !== undefined) {
          setLightVisibility(newLight, Boolean(l.visible !== false));
        }
      }
    });
  }

  // 5. Camera Navigation Constraints
  if (loadout.camera && state.cameraRig) {
    if (typeof loadout.camera.minPitch === "number") {
      state.cameraRig.setMinPitchDeg(loadout.camera.minPitch);
    }
    if (typeof loadout.camera.maxPitch === "number") {
      state.cameraRig.setMaxPitchDeg(loadout.camera.maxPitch);
    }
    if (typeof loadout.camera.minDistance === "number") {
      state.cameraRig.minDistance = loadout.camera.minDistance;
    }
    if (typeof loadout.camera.maxDistance === "number") {
      state.cameraRig.maxDistance = loadout.camera.maxDistance;
    }
    if (loadout.camera.autoRotate !== undefined) {
      state.cameraRig.autoRotate = Boolean(loadout.camera.autoRotate);
    }
  }

  // 6. Gizmo Configuration
  if (loadout.gizmo && state.gizmo) {
    Object.assign(state.gizmo, loadout.gizmo);
  }

  if (notify) {
    notifySelectionChanged();
  }
}

/**
 * Initializes startup loadout when the editor boots.
 * If a custom loadout exists in localStorage, applies it; otherwise applies factory defaults.
 */
export function initStartupLoadout() {
  const customLoadout = getStoredLoadout();
  if (customLoadout) {
    console.info("[Loadout] Applying saved custom startup loadout from localStorage.");
    applyLoadout(customLoadout, { syncUI: false, notify: false });
    return true;
  }
  return false;
}
