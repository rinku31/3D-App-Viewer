/**
 * Embed Viewer Commercial HUD Module
 * Manages the floating control pill (Scene Title, Reset View, Play/Pause Turntable, Fullscreen),
 * bottom-right lighting environment selector, inactivity auto-hide, keyboard shortcuts, and touch controls.
 */

import { state } from "../state/state.js";
import { setEmbedBloomEnabled } from "../render/render.js";

const BASE_AUTOROTATE_SPEED = 0.016;
export const SPEED_MULTIPLIERS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1.0 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
  { label: "3x", value: 3.0 }
];
let currentSpeedIndex = 1; // Default: 1x

let isExploded = false;
let isSimulating = false;
const originalMeshTransforms = new Map();

/**
 * Initializes the Viewer HUD overlay, event handlers, keyboard shortcuts,
 * environment preset selector, and auto-hide inactivity controller.
 */
export function initializeViewerHUD() {
  createHUDMarkup();
  createActionStackMarkup();
  createEnvironmentSelectorMarkup();
  createLoadingOverlayMarkup();
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
    <button id="hudSimulatorBtn" class="hud-action-btn" type="button" title="Simulator (Interactive Testing)" aria-label="Simulator Mode">
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
 * Injects a subtle loading spinner overlay
 */
function createLoadingOverlayMarkup() {
  const existing = document.getElementById("embedLoadingOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "embedLoadingOverlay";
  overlay.className = "hidden";
  overlay.innerHTML = `
    <div class="embed-spinner"></div>
    <div class="embed-loading-text" id="embedLoadingText">Loading 3D Scene...</div>
  `;
  document.body.appendChild(overlay);
  state.loadingOverlay = overlay;
}

export function showLoading(text = "Loading 3D Scene...") {
  const overlay = document.getElementById("embedLoadingOverlay");
  const textEl = document.getElementById("embedLoadingText");
  if (overlay) {
    if (textEl) textEl.textContent = text;
    overlay.classList.remove("hidden");
  }
}

export function hideLoading() {
  const overlay = document.getElementById("embedLoadingOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

/**
 * Toggles bloom glow effect in Embed viewer.
 */
export function toggleEmbedBloom() {
  const next = !Boolean(state.bloom?.enabled);
  setEmbedBloomEnabled(next);
  updateBloomBtnUI(next);
  state.visibilityDirty = true;
}

/**
 * Updates Bloom button visual state.
 */
export function updateBloomBtnUI(active) {
  const btn = document.getElementById("hudBloomBtn");
  if (btn) {
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  }
}

/**
 * Binds click events to switch environment HDR presets and bloom toggle.
 */
function bindEnvironmentSelectorActions() {
  const container = document.getElementById("viewerEnvSelector");
  if (!container) return;

  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleEmbedBloom();
    });
  }

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

      setEnvironmentPreset(preset);
    });
  });
}

/**
 * Programmatically sets the environment preset.
 */
export function setEnvironmentPreset(preset) {
  if (!state.environmentManager) return;

  const normalized = preset === "balance" ? "studio_small_09"
    : preset === "urban" ? "potsdamer_platz"
    : preset === "nature" ? "autumn_ground"
    : preset === "industrial" ? "aircraft_workshop"
    : preset;

  updateActiveEnvButton(normalized);

  state.environmentManager.loadEnvironment(normalized, () => {
    state.visibilityDirty = true;
  });

  if (state.sceneDocument) {
    if (!state.sceneDocument.scene) state.sceneDocument.scene = {};
    if (!state.sceneDocument.scene.environment) state.sceneDocument.scene.environment = {};
    state.sceneDocument.scene.environment.preset = normalized;
  }
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
 * Toggles interactive Simulator mode and triggers outside function/iframe messaging.
 */
export function toggleSimulatorMode() {
  isSimulating = !isSimulating;
  updateSimulatorBtnUI(isSimulating);

  const controls = state.sceneDocument?.settings?.controls || state.sceneDocument?.scene?.controls || {};
  const funcName = (controls.simulatorJsFunction || controls.jsFunction || "onSimulatorToggle").trim();
  const url = (controls.simulatorUrl || controls.url || "").trim();

  // If a URL is configured, open on activation
  if (url && isSimulating) {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {}
  }

  const payload = {
    type: "SIMULATOR_TOGGLE",
    action: isSimulating ? "start" : "stop",
    active: isSimulating,
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

/**
 * Updates Simulator button visual state.
 */
export function updateSimulatorBtnUI(active) {
  const btn = document.getElementById("hudSimulatorBtn");
  if (btn) {
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.classList.add("btn-pulsed");
    setTimeout(() => btn.classList.remove("btn-pulsed"), 300);
  }
}

/**
 * Binds button click and interaction events for the HUD.
 */
function bindHUDActions() {
  const resetBtn = document.getElementById("hudResetViewBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      resetViewerCamera();
    });
  }

  const autoRotateBtn = document.getElementById("hudAutoRotateBtn");
  if (autoRotateBtn) {
    autoRotateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAutoRotate();
    });
  }

  const speedBtn = document.getElementById("hudSpeedBtn");
  if (speedBtn) {
    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleTurntableSpeed();
    });
  }

  const fullscreenBtn = document.getElementById("hudFullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  document.addEventListener("fullscreenchange", updateFullscreenUIState);
  document.addEventListener("webkitfullscreenchange", updateFullscreenUIState);

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
 * Updates the Scene Title displayed on the HUD brand pill and syncs action stack buttons.
 */
export function updateHudSceneInfo(title) {
  const titleEl = document.getElementById("hudSceneTitle");
  if (titleEl) {
    let rawTitle = title
      || state.sceneDocument?.metadata?.title
      || state.currentModel?.name
      || "Product Showcase";
      
    // Remove " Scene" suffix if present
    const cleanedTitle = rawTitle.replace(/\s+Scene$/i, "").trim() || "Product Showcase";

    titleEl.textContent = cleanedTitle;
    titleEl.setAttribute("title", cleanedTitle);
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
 * Smoothly resets the CameraRig to its default viewing angle and focus distance,
 * pauses turntable auto-rotation, unexplodes model, and dismisses active hotspot popups.
 */
export function resetViewerCamera() {
  if (!state.cameraRig) return;

  // 1. Pause 360 auto-rotation when resetting
  state.cameraRig.autoRotate = false;
  updateAutoRotateUIState(false);

  // 2. Return exploded parts to initial position
  if (isExploded) {
    isExploded = false;
    applyExplosion(false);
    updateExplodeBtnUI(false);
  }
  if (isSimulating) {
    isSimulating = false;
    updateSimulatorBtnUI(false);
  }

  // 3. Smoothly reset camera orientation & distance
  state.cameraRig.reset();
  state.visibilityDirty = true;

  // 4. Dismiss active hotspot panels & markers
  if (state.hotspots) {
    state.hotspots.forEach((h) => {
      if (h.panel) h.panel.style.display = "none";
      if (h.line) h.line.style.display = "none";
      if (h.dot) h.dot.classList.remove("active");
      h.active = false;
    });
  }

  // 5. Pulse visual feedback on the default view button
  const defaultBtn = document.getElementById("hudDefaultViewBtn") || document.getElementById("hudResetViewBtn");
  if (defaultBtn) {
    defaultBtn.classList.add("btn-pulsed");
    setTimeout(() => defaultBtn.classList.remove("btn-pulsed"), 400);
  }
}

/**
 * Toggles auto-rotation (turntable) playback state.
 */
export function toggleAutoRotate(forceState) {
  if (!state.cameraRig) return;

  const currentState = state.cameraRig.autoRotate;
  const nextState = typeof forceState === "boolean" ? forceState : !currentState;

  state.cameraRig.autoRotate = nextState;
  state.cameraRig.autoRotateSpeed = BASE_AUTOROTATE_SPEED * SPEED_MULTIPLIERS[currentSpeedIndex].value;

  updateAutoRotateUIState(nextState);
}

/**
 * Sets turntable speed directly (e.g. 0.5, 1.0, 1.5, 2.0, 3.0)
 */
export function setTurntableSpeed(val) {
  const numVal = Number(val);
  const foundIdx = SPEED_MULTIPLIERS.findIndex(s => Math.abs(s.value - numVal) < 0.01);
  if (foundIdx !== -1) {
    currentSpeedIndex = foundIdx;
  }
  if (state.cameraRig && state.cameraRig.autoRotate) {
    state.cameraRig.autoRotateSpeed = BASE_AUTOROTATE_SPEED * SPEED_MULTIPLIERS[currentSpeedIndex].value;
  }
  updateSpeedBtnUI();
}

/**
 * Cycles the turntable rotation speed through available multipliers.
 */
export function cycleTurntableSpeed() {
  currentSpeedIndex = (currentSpeedIndex + 1) % SPEED_MULTIPLIERS.length;
  if (state.cameraRig) {
    state.cameraRig.autoRotateSpeed = BASE_AUTOROTATE_SPEED * SPEED_MULTIPLIERS[currentSpeedIndex].value;
  }
  updateSpeedBtnUI();
}

function updateSpeedBtnUI() {
  const current = SPEED_MULTIPLIERS[currentSpeedIndex];
  const speedLabel = document.getElementById("hudSpeedLabel");
  const speedBtn = document.getElementById("hudSpeedBtn");
  if (speedLabel) speedLabel.textContent = current.label;
  if (speedBtn) speedBtn.setAttribute("title", `Turntable Speed: ${current.label} (Click to cycle)`);
}

/**
 * Updates HUD icon and label for turntable play/pause state.
 */
function updateAutoRotateUIState(isPlaying) {
  const btn = document.getElementById("hudAutoRotateBtn");
  const icon = document.getElementById("hudAutoRotateIcon");
  const label = document.getElementById("hudAutoRotateLabel");
  const speedBtn = document.getElementById("hudSpeedBtn");

  if (!btn || !icon || !label) return;

  if (isPlaying) {
    btn.classList.add("active");
    btn.setAttribute("title", "Pause Turntable [Key: Space]");
    label.textContent = "Pause";
    icon.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
    if (speedBtn) speedBtn.style.display = "inline-flex";
  } else {
    btn.classList.remove("active");
    btn.setAttribute("title", "Play Turntable [Key: Space]");
    label.textContent = "Play";
    icon.innerHTML = `<polygon points="6 4 20 12 6 20 6 4"></polygon>`;
    if (speedBtn) speedBtn.style.display = "none";
  }
}

/**
 * Toggles fullscreen mode for the viewer container / document body.
 */
export function toggleFullscreen() {
  const doc = document;
  const docEl = document.documentElement;

  const isFs = doc.fullscreenElement || doc.webkitFullscreenElement;

  if (!isFs) {
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    }
  } else {
    if (doc.exitFullscreen) {
      doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    }
  }
}

/**
 * Updates Fullscreen button icon and label.
 */
function updateFullscreenUIState() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const icon = document.getElementById("hudFullscreenIcon");
  const label = document.getElementById("hudFullscreenLabel");

  if (!icon || !label) return;

  if (isFs) {
    label.textContent = "Exit";
    icon.innerHTML = `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>`;
  } else {
    label.textContent = "Fullscreen";
    icon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
  }
}

/**
 * Configures keyboard shortcuts: Space (Turntable), R (Reset), F (Fullscreen).
 */
function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;

    if (e.code === "Space") {
      e.preventDefault();
      toggleAutoRotate();
    } else if (e.key === "r" || e.key === "R") {
      resetViewerCamera();
    } else if (e.key === "f" || e.key === "F") {
      toggleFullscreen();
    } else if (e.key === "b" || e.key === "B") {
      toggleEmbedBloom();
    }
  });
}

/**
 * Inactivity controller to smoothly fade out chrome when idle.
 */
function setupInactivityAutoHide() {
  const wakeUpChrome = () => {
    state.isChromeHovered = false;
    showChrome();
    scheduleInactivityHide();
  };

  const cancelInactivity = () => {
    state.isChromeHovered = true;
    showChrome();
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;
    }
  };

  window.addEventListener("mousemove", wakeUpChrome, { passive: true });
  window.addEventListener("touchstart", wakeUpChrome, { passive: true });
  window.addEventListener("pointerdown", wakeUpChrome, { passive: true });

  [state.hud, state.actionStack, state.envSelector].forEach((el) => {
    if (el) {
      el.addEventListener("mouseenter", cancelInactivity);
      el.addEventListener("mouseleave", wakeUpChrome);
      el.addEventListener("focusin", cancelInactivity);
      el.addEventListener("focusout", wakeUpChrome);
    }
  });

  scheduleInactivityHide();
}

function showChrome() {
  if (state.hud) state.hud.classList.remove("viewer-chrome-hidden");
  if (state.actionStack) state.actionStack.classList.remove("viewer-chrome-hidden");
  if (state.envSelector) state.envSelector.classList.remove("viewer-chrome-hidden");
}

function hideChrome() {
  if (state.isChromeHovered) return;
  if (state.hud) state.hud.classList.add("viewer-chrome-hidden");
  if (state.actionStack) state.actionStack.classList.add("viewer-chrome-hidden");
  if (state.envSelector) state.envSelector.classList.add("viewer-chrome-hidden");
}

function scheduleInactivityHide() {
  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer);
  }
  state.inactivityTimer = setTimeout(() => {
    hideChrome();
  }, state.inactivityThresholdMs);
}

export function refreshTourSteps() {
  // Available if tour steps exist in scene document
}
