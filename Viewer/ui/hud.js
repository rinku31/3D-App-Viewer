/**
 * Viewer Commercial HUD Module
 * Manages the floating control pill (Scene Title, Reset View, Play/Pause Turntable, Fullscreen),
 * inactivity chrome auto-hide, keyboard shortcuts, and touch interactions.
 */

import { state } from "../state/state.js";
import { setViewerBloomEnabled } from "../render/render.js";

const BASE_AUTOROTATE_SPEED = 0.016;
const SPEED_MULTIPLIERS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1.0 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
  { label: "3x", value: 3.0 }
];
let currentSpeedIndex = 1; // Default: 1x

let isExploded = false;
const originalMeshTransforms = new Map();

/**
 * Initializes the Viewer HUD overlay, event handlers, keyboard shortcuts,
 * environment preset selector, and auto-hide inactivity controller.
 */
export function initializeViewerHUD() {
  createHUDMarkup();
  createActionStackMarkup();
  createEnvironmentSelectorMarkup();
  bindHUDActions();
  bindActionStackEvents();
  bindEnvironmentSelectorActions();
  setupInactivityAutoHide();
  setupKeyboardShortcuts();
  updateHudSceneInfo();
}

/**
 * Injects the middle-right Quick Action stack (Explode, Default, Simulator) into the DOM.
 */
function createActionStackMarkup() {
  const existing = document.getElementById("viewerActionStack");
  if (existing) existing.remove();

  const stack = document.createElement("nav");
  stack.id = "viewerActionStack";
  stack.className = "viewer-action-stack";
  stack.setAttribute("aria-label", "Scene Actions");

  stack.innerHTML = `
    <!-- 1. Explode Button (Top) -->
    <button id="hudExplodeBtn" class="hud-action-btn" type="button" title="Explode View (Toggle parts separation)" aria-label="Explode View">
      <svg class="hud-action-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21 16-4 4-4-4"></path>
        <path d="M17 20V4"></path>
        <path d="m3 8 4-4 4 4"></path>
        <path d="M7 4v16"></path>
      </svg>
      <span class="hud-action-label">Explode</span>
    </button>

    <!-- 2. Default View Button (Middle) -->
    <button id="hudDefaultViewBtn" class="hud-action-btn" type="button" title="Default View (Reset Camera) [Key: R]" aria-label="Default Camera View">
      <svg class="hud-action-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
      </svg>
      <span class="hud-action-label">Default</span>
    </button>

    <!-- 3. Simulator Button (Bottom) -->
    <button id="hudSimulatorBtn" class="hud-action-btn" type="button" title="Simulator (Interactive Testing)" aria-label="Simulator Action">
      <svg class="hud-action-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="10 8 16 12 10 16 10 8"></polygon>
      </svg>
      <span class="hud-action-label">Simulator</span>
    </button>
  `;

  document.body.appendChild(stack);
  state.actionStack = stack;
}

const ENV_PRESET_CONFIG = {
  studio_small_09: {
    id: "studio_small_09",
    name: "Studio",
    iconSvg: `<svg class="env-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v3h10V7a5 5 0 0 0-5-5Z"></path><path d="M5 10h14"></path><path d="M12 13v8"></path><path d="M8 21h8"></path><circle cx="12" cy="6.5" r="1" fill="currentColor"></circle></svg>`
  },
  potsdamer_platz: {
    id: "potsdamer_platz",
    name: "Urban",
    iconSvg: `<svg class="env-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9h1"></path><path d="M9 13h1"></path><path d="M9 17h1"></path></svg>`
  },
  autumn_ground: {
    id: "autumn_ground",
    name: "Nature",
    iconSvg: `<svg class="env-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>`
  },
  aircraft_workshop: {
    id: "aircraft_workshop",
    name: "Industrial",
    iconSvg: `<svg class="env-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M17 18h1"></path><path d="M12 18h1"></path><path d="M7 18h1"></path></svg>`
  }
};

/**
 * Injects the bottom-right Environment Option selector into the DOM.
 */
function createEnvironmentSelectorMarkup() {
  const existing = document.getElementById("viewerEnvSelector");
  if (existing) existing.remove();

  const envContainer = document.createElement("nav");
  envContainer.id = "viewerEnvSelector";
  envContainer.className = "viewer-env-selector";
  envContainer.setAttribute("aria-label", "Lighting and Effects Selector");

  envContainer.innerHTML = `
    <!-- Bloom Glow Toggle Button beside Environment Options -->
    <button id="hudBloomBtn" class="env-btn hud-bloom-btn" type="button" title="Toggle Bloom Glow [Key: B]" aria-label="Toggle Bloom Glow">
      <svg id="hudBloomIcon" class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2"></path>
        <path d="M12 20v2"></path>
        <path d="m4.93 4.93 1.41 1.41"></path>
        <path d="m17.66 17.66 1.41 1.41"></path>
        <path d="M2 12h2"></path>
        <path d="M20 12h2"></path>
        <path d="m6.34 17.66-1.41 1.41"></path>
        <path d="m19.07 4.93-1.41 1.41"></path>
      </svg>
      <span class="env-tooltip">Bloom Glow</span>
    </button>

    <div class="env-divider"></div>

    <!-- Environment Dropdown -->
    <div class="env-dropdown-wrapper" id="hudEnvDropdownWrapper">
      <button id="hudEnvDropdownBtn" class="env-dropdown-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Select Environment Lighting">
        <span class="env-dropdown-icon" id="hudEnvCurrentIcon">
          ${ENV_PRESET_CONFIG.studio_small_09.iconSvg}
        </span>
        <span class="env-dropdown-label" id="hudEnvCurrentLabel">Studio</span>
        <svg class="env-dropdown-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      <div class="env-dropdown-menu" id="hudEnvDropdownMenu" role="menu">
        <button class="env-dropdown-item active" data-preset="studio_small_09" data-name="Studio" type="button" role="menuitem">
          <span class="env-dropdown-item-icon">${ENV_PRESET_CONFIG.studio_small_09.iconSvg}</span>
          <span class="env-dropdown-item-label">Studio</span>
        </button>
        <button class="env-dropdown-item" data-preset="potsdamer_platz" data-name="Urban" type="button" role="menuitem">
          <span class="env-dropdown-item-icon">${ENV_PRESET_CONFIG.potsdamer_platz.iconSvg}</span>
          <span class="env-dropdown-item-label">Urban</span>
        </button>
        <button class="env-dropdown-item" data-preset="autumn_ground" data-name="Nature" type="button" role="menuitem">
          <span class="env-dropdown-item-icon">${ENV_PRESET_CONFIG.autumn_ground.iconSvg}</span>
          <span class="env-dropdown-item-label">Nature</span>
        </button>
        <button class="env-dropdown-item" data-preset="aircraft_workshop" data-name="Industrial" type="button" role="menuitem">
          <span class="env-dropdown-item-icon">${ENV_PRESET_CONFIG.aircraft_workshop.iconSvg}</span>
          <span class="env-dropdown-item-label">Industrial</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(envContainer);
  state.envSelector = envContainer;
}

/**
 * Binds click events to toggle dropdown and switch environment HDR preset while preserving solid background color.
 */
function bindEnvironmentSelectorActions() {
  const container = document.getElementById("viewerEnvSelector");
  if (!container) return;

  const dropdownWrapper = document.getElementById("hudEnvDropdownWrapper");
  const dropdownBtn = document.getElementById("hudEnvDropdownBtn");

  // Toggle dropdown menu
  if (dropdownBtn && dropdownWrapper) {
    dropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownWrapper.classList.toggle("open");
      dropdownBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Close dropdown on outside click
  window.addEventListener("click", (e) => {
    if (dropdownWrapper && dropdownWrapper.classList.contains("open")) {
      if (!dropdownWrapper.contains(e.target)) {
        dropdownWrapper.classList.remove("open");
        dropdownBtn?.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Handle preset option clicks
  container.querySelectorAll(".env-dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const preset = item.getAttribute("data-preset");
      if (!preset || !state.environmentManager) return;

      // Close dropdown
      if (dropdownWrapper) {
        dropdownWrapper.classList.remove("open");
        dropdownBtn?.setAttribute("aria-expanded", "false");
      }

      // Update active button state
      updateActiveEnvButton(preset);

      // Instantaneous environment switch
      state.environmentManager.loadEnvironment(preset, () => {
        state.visibilityDirty = true;
      });

      // Update scene document if present
      if (state.sceneDocument) {
        if (!state.sceneDocument.scene) state.sceneDocument.scene = {};
        if (!state.sceneDocument.scene.environment) state.sceneDocument.scene.environment = {};
        state.sceneDocument.scene.environment.preset = preset;
      }
    });
  });
}

/**
 * Updates the active visual indicator and trigger button for environment preset.
 */
export function updateActiveEnvButton(activePreset) {
  const container = document.getElementById("viewerEnvSelector");
  if (!container) return;

  const normalized = activePreset === "balance" ? "studio_small_09"
    : activePreset === "urban" ? "potsdamer_platz"
    : activePreset === "nature" ? "autumn_ground"
    : activePreset === "industrial" ? "aircraft_workshop"
    : activePreset;

  const config = ENV_PRESET_CONFIG[normalized] || ENV_PRESET_CONFIG.studio_small_09;

  const currentIcon = document.getElementById("hudEnvCurrentIcon");
  const currentLabel = document.getElementById("hudEnvCurrentLabel");
  if (currentIcon) currentIcon.innerHTML = config.iconSvg;
  if (currentLabel) currentLabel.textContent = config.name;

  container.querySelectorAll(".env-dropdown-item[data-preset]").forEach((item) => {
    const isTarget = item.getAttribute("data-preset") === normalized;
    item.classList.toggle("active", isTarget);
  });
}

/**
 * Injects the floating control pill into the DOM.
 */
function createHUDMarkup() {
  const existing = document.getElementById("viewerHud");
  if (existing) existing.remove();

  const hudContainer = document.createElement("nav");
  hudContainer.id = "viewerHud";
  hudContainer.className = "viewer-hud";
  hudContainer.setAttribute("aria-label", "Viewer Controls");

  hudContainer.innerHTML = `
    <!-- 1. Brand / Title Pill -->
    <div class="hud-item hud-brand" id="hudBrandBadge" title="Current Product">
      <span class="hud-brand-dot"></span>
      <span class="hud-brand-text" id="hudSceneTitle">Product Showcase</span>
    </div>

    <div class="hud-divider"></div>

    <!-- 2. Controls Group: Play/Pause Turntable, Speed Multiplier, Fullscreen -->
    <div class="hud-group" role="toolbar" aria-label="Scene Controls">
      <!-- Play / Pause Auto-Rotate Turntable -->
      <button id="hudAutoRotateBtn" class="hud-btn" type="button" title="Play Turntable [Key: Space]" aria-label="Play 360° Turntable">
        <svg id="hudAutoRotateIcon" class="hud-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <polygon points="6 4 20 12 6 20 6 4"></polygon>
        </svg>
        <span id="hudAutoRotateLabel" class="hud-btn-label">Play</span>
      </button>

      <!-- Speed Multiplier (Visible only when auto-rotating) -->
      <button id="hudSpeedBtn" class="hud-btn hud-speed-btn" type="button" title="Turntable Speed: 1x (Click to cycle)" aria-label="Turntable Speed Multiplier" style="display: none;">
        <svg class="hud-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span id="hudSpeedLabel" class="hud-btn-label hud-speed-label">1x</span>
      </button>

      <div class="hud-divider"></div>

      <!-- Fullscreen Toggle -->
      <button id="hudFullscreenBtn" class="hud-btn" type="button" title="Toggle Fullscreen [Key: F]" aria-label="Toggle Fullscreen">
        <svg id="hudFullscreenIcon" class="hud-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
        <span id="hudFullscreenLabel" class="hud-btn-label">Fullscreen</span>
      </button>
    </div>
  `;

  document.body.appendChild(hudContainer);
  state.hud = hudContainer;
}

/**
 * Binds middle-right Action Stack button events.
 */
function bindActionStackEvents() {
  const explodeBtn = document.getElementById("hudExplodeBtn");
  if (explodeBtn) {
    explodeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleExplodedView();
    });
  }

  const defaultBtn = document.getElementById("hudDefaultViewBtn");
  if (defaultBtn) {
    defaultBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      resetViewerCamera();
    });
  }

  const simulatorBtn = document.getElementById("hudSimulatorBtn");
  if (simulatorBtn) {
    simulatorBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSimulatorMode();
    });
  }
}

/**
 * Toggles Exploded View of the 3D model.
 */
export function toggleExplodedView() {
  if (!state.currentModel) return;
  isExploded = !isExploded;
  applyExplosion(isExploded);
  updateExplodeBtnUI(isExploded);
}

/**
 * Smoothly explodes or collapses model parts.
 */
export function applyExplosion(exploded) {
  if (!state.currentModel) return;

  const meshes = [];
  state.currentModel.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) return;

  // Cache initial positions if not cached
  meshes.forEach((mesh) => {
    if (!originalMeshTransforms.has(mesh.uuid)) {
      originalMeshTransforms.set(mesh.uuid, {
        position: mesh.position.clone(),
        scale: mesh.scale.clone()
      });
    }
  });

  if (window.THREE) {
    const box = new window.THREE.Box3().setFromObject(state.currentModel);
    const center = new window.THREE.Vector3();
    box.getCenter(center);
    const size = new window.THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

    const duration = 500;
    const startTime = performance.now();

    const initialPositions = meshes.map((mesh) => mesh.position.clone());
    const targetPositions = meshes.map((mesh) => {
      const orig = originalMeshTransforms.get(mesh.uuid).position;
      if (!exploded) {
        return orig.clone();
      }
      const meshBox = new window.THREE.Box3().setFromObject(mesh);
      const meshCenter = new window.THREE.Vector3();
      meshBox.getCenter(meshCenter);

      const offset = new window.THREE.Vector3().subVectors(meshCenter, center);
      if (offset.lengthSq() < 0.0001) {
        offset.set(Math.sin(mesh.id || 1), Math.cos(mesh.id || 1), Math.sin((mesh.id || 1) * 2));
      }
      offset.normalize().multiplyScalar(maxDim * 0.38);
      return orig.clone().add(offset);
    });

    const animateExplosion = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      meshes.forEach((mesh, idx) => {
        mesh.position.lerpVectors(initialPositions[idx], targetPositions[idx], ease);
      });

      state.visibilityDirty = true;

      if (progress < 1.0) {
        requestAnimationFrame(animateExplosion);
      }
    };

    requestAnimationFrame(animateExplosion);
  }
}

/**
 * Updates Explode button visual state.
 */
export function updateExplodeBtnUI(active) {
  const btn = document.getElementById("hudExplodeBtn");
  if (btn) {
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.classList.add("btn-pulsed");
    setTimeout(() => btn.classList.remove("btn-pulsed"), 300);
  }
}

/**
 * Triggers Simulator action and messages outside iframe.
 */
export function triggerSimulatorAction() {
  const controls = state.sceneDocument?.settings?.controls || state.sceneDocument?.scene?.controls || {};
  const funcName = (controls.simulatorJsFunction || controls.jsFunction || "onSimulatorClick").trim();
  const url = (controls.simulatorUrl || controls.url || "").trim();

  const btn = document.getElementById("hudSimulatorBtn");
  if (btn) {
    btn.classList.add("btn-pulsed");
    setTimeout(() => btn.classList.remove("btn-pulsed"), 300);
  }

  // If a URL is configured, open on activation
  if (url) {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {}
  }

  const payload = {
    type: "SIMULATOR_ACTION",
    action: "click",
    functionName: funcName,
    sceneTitle: state.sceneDocument?.metadata?.title || state.currentModel?.name || "Product Showcase",
    modelName: state.currentModel?.name || "",
    timestamp: Date.now()
  };

  // 1. Call function in parent window if available (e.g. window.parent[funcName])
  try {
    if (funcName) {
      if (window.parent && typeof window.parent[funcName] === "function") {
        window.parent[funcName](payload);
      } else if (typeof window[funcName] === "function") {
        window[funcName](payload);
      }
    }
  } catch (_) {}

  // 2. PostMessage to parent frame for iframe embedding
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage(payload, "*");
    } catch (_) {}
  }
}

// Backward compatibility
export const toggleSimulatorMode = triggerSimulatorAction;
export const updateSimulatorBtnUI = () => {};

/**
 * Binds button click and interaction events for the HUD.
 */
function bindHUDActions() {
  // 1. Reset View Button
  const resetBtn = document.getElementById("hudResetViewBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      resetViewerCamera();
    });
  }

  // 2. Play / Pause Turntable Toggle Button
  const autoRotateBtn = document.getElementById("hudAutoRotateBtn");
  if (autoRotateBtn) {
    autoRotateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAutoRotate();
    });
  }

  // 3. Speed Multiplier Cycle Button
  const speedBtn = document.getElementById("hudSpeedBtn");
  if (speedBtn) {
    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleSpeedMultiplier();
    });
  }

  // 4. Bloom Glow Toggle Button
  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleViewerBloom();
    });
  }

  // 5. Fullscreen Toggle Button
  const fsBtn = document.getElementById("hudFullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });

    const onFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      updateFullscreenUI(isFs);
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("mozfullscreenchange", onFsChange);
    document.addEventListener("MSFullscreenChange", onFsChange);
  }

  // Canvas click to deselect active hotspot panels
  const rendererDom = state.renderer?.domElement;
  if (rendererDom) {
    rendererDom.addEventListener("click", () => {
      if (state.hotspots) {
        state.hotspots.forEach((h) => {
          if (h.active && h.panel) {
            h.active = false;
            h.panel.style.display = "none";
            if (h.line) h.line.style.display = "none";
            if (h.dot) h.dot.classList.remove("active");
          }
        });
      }
    });
  }
}

/**
 * Resets camera smoothly to initial default state.
 */
export function resetViewerCamera() {
  if (!state.cameraRig) return;
  
  // Pause 360 auto-rotation when resetting
  state.cameraRig.autoRotate = false;
  updatePlayPauseUI(false);

  // If exploded, smoothly return parts to default
  if (isExploded) {
    isExploded = false;
    applyExplosion(false);
    updateExplodeBtnUI(false);
  }

  state.cameraRig.reset();

  // Close active hotspot info panels
  state.hotspots?.forEach((h) => {
    if (h.panel) h.panel.style.display = "none";
    if (h.line) h.line.style.display = "none";
    if (h.dot) h.dot.classList.remove("active");
    h.active = false;
  });

  const btn = document.getElementById("hudDefaultViewBtn") || document.getElementById("hudResetViewBtn");
  if (btn) {
    btn.classList.add("btn-pulsed");
    setTimeout(() => btn.classList.remove("btn-pulsed"), 400);
  }
}

/**
 * Toggles auto-rotate turntable on CameraRig and updates the Play/Pause button UI.
 */
export function toggleAutoRotate() {
  if (!state.cameraRig) return;
  const isRotating = !state.cameraRig.autoRotate;
  state.cameraRig.autoRotate = isRotating;
  if (isRotating) {
    applyCurrentSpeed();
  }

  updatePlayPauseUI(isRotating);
}

/**
 * Cycles through available speed multipliers (0.5x, 1x, 1.5x, 2x, 3x).
 */
export function cycleSpeedMultiplier() {
  currentSpeedIndex = (currentSpeedIndex + 1) % SPEED_MULTIPLIERS.length;
  applyCurrentSpeed();
}

/**
 * Applies the current speed multiplier to the CameraRig and updates button label.
 */
function applyCurrentSpeed() {
  const current = SPEED_MULTIPLIERS[currentSpeedIndex];
  if (state.cameraRig) {
    state.cameraRig.autoRotateSpeed = BASE_AUTOROTATE_SPEED * current.value;
  }
  const speedBtn = document.getElementById("hudSpeedBtn");
  const speedLabel = document.getElementById("hudSpeedLabel");
  if (speedLabel) speedLabel.textContent = current.label;
  if (speedBtn) {
    speedBtn.title = `Turntable Speed: ${current.label} (Click to cycle)`;
    speedBtn.setAttribute("aria-label", `Turntable Speed: ${current.label}`);
    speedBtn.classList.add("btn-pulsed");
    setTimeout(() => speedBtn.classList.remove("btn-pulsed"), 250);
  }
}

/**
 * Updates the Play/Pause button icon, label, and active status,
 * and controls visibility of the speed multiplier.
 */
function updatePlayPauseUI(isRotating) {
  const btn = document.getElementById("hudAutoRotateBtn");
  const icon = document.getElementById("hudAutoRotateIcon");
  const label = document.getElementById("hudAutoRotateLabel");
  const speedBtn = document.getElementById("hudSpeedBtn");
  if (!btn || !icon || !label) return;

  btn.classList.toggle("active", isRotating);

  if (isRotating) {
    btn.title = "Pause Turntable [Key: Space]";
    btn.setAttribute("aria-label", "Pause 360° Turntable");
    label.textContent = "Pause";
    // Pause Icon: Two vertical bars
    icon.innerHTML = `
      <rect x="6" y="4" width="4" height="16" rx="1"></rect>
      <rect x="14" y="4" width="4" height="16" rx="1"></rect>
    `;
    if (speedBtn) {
      speedBtn.style.display = "inline-flex";
      applyCurrentSpeed();
    }
  } else {
    btn.title = "Play Turntable [Key: Space]";
    btn.setAttribute("aria-label", "Play 360° Turntable");
    label.textContent = "Play";
    // Play Icon: Right pointing triangle
    icon.innerHTML = `
      <polygon points="6 4 20 12 6 20 6 4"></polygon>
    `;
    if (speedBtn) {
      speedBtn.style.display = "none";
    }
  }
}

/**
 * Toggles browser fullscreen mode.
 */
export function toggleFullscreen() {
  const isFs = Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

  if (!isFs) {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

/**
 * Toggles Bloom Glow post-processing on/off in the viewer
 */
export function toggleViewerBloom() {
  const current = Boolean(state.bloom?.enabled);
  const next = !current;
  setViewerBloomEnabled(next);

  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.classList.toggle("active", next);
    bloomBtn.classList.add("btn-pulsed");
    setTimeout(() => bloomBtn.classList.remove("btn-pulsed"), 400);
  }
}

/**
 * Updates the fullscreen button icon and label based on active status.
 */
function updateFullscreenUI(isFullscreen) {
  const btn = document.getElementById("hudFullscreenBtn");
  const icon = document.getElementById("hudFullscreenIcon");
  const label = document.getElementById("hudFullscreenLabel");
  if (!btn || !icon || !label) return;

  btn.classList.toggle("active", isFullscreen);

  if (isFullscreen) {
    label.textContent = "Exit";
    btn.title = "Exit Fullscreen [Key: F]";
    btn.setAttribute("aria-label", "Exit Fullscreen");
    icon.innerHTML = `
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
    `;
  } else {
    label.textContent = "Fullscreen";
    btn.title = "Toggle Fullscreen [Key: F]";
    btn.setAttribute("aria-label", "Toggle Fullscreen");
    icon.innerHTML = `
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
    `;
  }
}

/**
 * Sanitizes and updates the product showcase title, removing trailing " Scene",
 * and syncs active environment preset button and bloom button.
 */
export function updateHudSceneInfo() {
  const titleEl = document.getElementById("hudSceneTitle");
  if (titleEl) {
    let rawTitle = state.sceneDocument?.metadata?.title || state.currentModel?.name || "Viper V4 Pro";
    // Remove " Scene" suffix if present
    const cleanedTitle = rawTitle.replace(/\s+Scene$/i, "").trim() || "Product Showcase";
    titleEl.textContent = cleanedTitle;
  }

  // Sync active environment preset indicator
  const activePreset = state.sceneDocument?.scene?.environment?.preset || state.environmentManager?.getCurrentPreset() || "studio_small_09";
  updateActiveEnvButton(activePreset);

  // Sync Bloom button active status
  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.classList.toggle("active", Boolean(state.bloom?.enabled));
  }

  // Sync Action Stack (Explode, Default, Simulator) visibility based on controls configuration
  const controls = state.sceneDocument?.settings?.controls || state.sceneDocument?.scene?.controls || {
    defaultEnabled: true,
    explodeEnabled: true,
    simulatorEnabled: true
  };

  const explodeBtn = document.getElementById("hudExplodeBtn");
  if (explodeBtn) {
    explodeBtn.style.display = controls.explodeEnabled !== false ? "flex" : "none";
  }

  const defaultBtn = document.getElementById("hudDefaultViewBtn");
  if (defaultBtn) {
    defaultBtn.style.display = controls.defaultEnabled !== false ? "flex" : "none";
  }

  const simulatorBtn = document.getElementById("hudSimulatorBtn");
  if (simulatorBtn) {
    simulatorBtn.style.display = controls.simulatorEnabled !== false ? "flex" : "none";
  }

  const actionStack = document.getElementById("viewerActionStack");
  if (actionStack) {
    const anyVisible = controls.explodeEnabled !== false || controls.defaultEnabled !== false || controls.simulatorEnabled !== false;
    actionStack.style.display = anyVisible ? "flex" : "none";
  }
}

/**
 * Compatibility alias for backward compatibility across loaders.
 */
export function refreshTourSteps() {
  updateHudSceneInfo();
}

/**
 * Sets up inactivity auto-hide for header, floating HUD, action stack, and environment selector.
 * Fades out overlay controls after 3.5s of inactivity unless hovered.
 */
function setupInactivityAutoHide() {
  const header = document.getElementById("viewerHeader");
  const hud = document.getElementById("viewerHud");
  const actionStack = document.getElementById("viewerActionStack");
  const envSelector = document.getElementById("viewerEnvSelector");

  const resetTimer = () => {
    setChromeVisible(true);

    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;
    }

    if (state.isChromeHovered) return;

    state.inactivityTimer = setTimeout(() => {
      if (!state.isChromeHovered) {
        setChromeVisible(false);
      }
    }, state.inactivityThresholdMs);
  };

  // Hover tracking on UI Chrome
  [header, hud, actionStack, envSelector].forEach((el) => {
    if (!el) return;
    el.addEventListener("mouseenter", () => {
      state.isChromeHovered = true;
      setChromeVisible(true);
      if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
    });

    el.addEventListener("mouseleave", () => {
      state.isChromeHovered = false;
      resetTimer();
    });
  });

  // User input events reset the inactivity timer
  const events = ["pointermove", "pointerdown", "touchstart", "touchmove", "wheel", "keydown"];
  events.forEach((evt) => {
    window.addEventListener(evt, resetTimer, { passive: true });
  });

  // Initial timer setup
  resetTimer();
}

/**
 * Toggles chrome visibility class.
 */
export function setChromeVisible(visible) {
  const header = document.getElementById("viewerHeader");
  const hud = document.getElementById("viewerHud");
  const actionStack = document.getElementById("viewerActionStack");
  const envSelector = document.getElementById("viewerEnvSelector");

  if (visible) {
    header?.classList.remove("viewer-chrome-hidden");
    hud?.classList.remove("viewer-chrome-hidden");
    actionStack?.classList.remove("viewer-chrome-hidden");
    envSelector?.classList.remove("viewer-chrome-hidden");
  } else {
    header?.classList.add("viewer-chrome-hidden");
    hud?.classList.add("viewer-chrome-hidden");
    actionStack?.classList.add("viewer-chrome-hidden");
    envSelector?.classList.add("viewer-chrome-hidden");
  }
}

/**
 * Binds global keyboard shortcuts for viewer presentation.
 */
function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input" || activeTag === "textarea") return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        toggleAutoRotate();
        break;

      case "KeyR":
        e.preventDefault();
        resetViewerCamera();
        break;

      case "KeyF":
        e.preventDefault();
        toggleFullscreen();
        break;

      case "KeyB":
        e.preventDefault();
        toggleViewerBloom();
        break;

      case "Escape":
        // Close environment dropdown if open
        const dropdownWrapper = document.getElementById("hudEnvDropdownWrapper");
        if (dropdownWrapper && dropdownWrapper.classList.contains("open")) {
          dropdownWrapper.classList.remove("open");
          const btn = document.getElementById("hudEnvDropdownBtn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
        // Close hotspot panels
        state.hotspots?.forEach((h) => {
          if (h.panel) h.panel.style.display = "none";
          if (h.line) h.line.style.display = "none";
          if (h.dot) h.dot.classList.remove("active");
          h.active = false;
        });
        break;
    }
  });
}
