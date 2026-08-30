/**
 * Shared Viewer HUD & Interactivity Controller
 * Manages the floating control pill, turntable rotation, speed multipliers,
 * exploded view animations, simulator triggers, HDR preset switcher,
 * auto-hiding chrome on 3.5s inactivity, and keyboard shortcuts.
 */

import * as THREE from "three";
import { HDR_PRESETS } from "./environment.js";

const BASE_AUTOROTATE_SPEED = 0.016;
const SPEED_MULTIPLIERS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1.0 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
  { label: "3x", value: 3.0 }
];

/**
 * Initializes all HUD components, action buttons, environment selector, and auto-hide logic.
 * @param {object} viewerState - Active viewer state object
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.isEmbed=false] - Whether running inside compact iframe
 */
export function initializeViewerHUD(viewerState, options = {}) {
  viewerState._currentSpeedIndex = 1;
  viewerState._isExploded = false;
  viewerState._isSimulating = false;
  viewerState._originalMeshTransforms = new Map();

  createHUDMarkup(viewerState, options);
  createActionStackMarkup(viewerState);
  createEnvironmentSelectorMarkup(viewerState);

  bindHUDActions(viewerState);
  bindActionStackEvents(viewerState);
  bindEnvironmentSelectorActions(viewerState);
  setupInactivityAutoHide(viewerState);
  setupKeyboardShortcuts(viewerState);

  updateHudSceneInfo(viewerState);
}

/**
 * Injects the bottom floating HUD control pill into the DOM.
 */
function createHUDMarkup(viewerState, options) {
  const existing = document.getElementById("viewerHud");
  if (existing) existing.remove();

  const hud = document.createElement("nav");
  hud.id = "viewerHud";
  hud.className = "viewer-hud";
  hud.setAttribute("aria-label", "Viewer Controls");

  hud.innerHTML = `
    <!-- Scene Title & Metadata Badge -->
    <div class="hud-item hud-scene-info" id="hudSceneInfo" title="Current Model">
      <span class="hud-badge">3D</span>
      <span class="hud-title" id="hudSceneTitle">Loading...</span>
    </div>

    <div class="hud-divider"></div>

    <!-- Reset Camera Framing -->
    <button class="hud-btn" id="hudResetBtn" type="button" title="Reset View (R)" aria-label="Reset Camera View">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
      </svg>
      <span class="hud-btn-label">Reset</span>
    </button>

    <!-- Turntable Play/Pause -->
    <button class="hud-btn" id="hudTurntableBtn" type="button" title="Toggle 360° Turntable (Space)" aria-label="Toggle 360° Rotation">
      <svg id="hudPlayIcon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <svg id="hudPauseIcon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
      <span class="hud-btn-label">360°</span>
    </button>

    <!-- Turntable Speed Multiplier Pill -->
    <button class="hud-btn hud-speed-btn" id="hudSpeedBtn" type="button" title="Cycle Turntable Speed" aria-label="Change Rotation Speed">
      <span id="hudSpeedLabel">1x</span>
    </button>

    <div class="hud-divider"></div>

    <!-- Fullscreen Toggle -->
    <button class="hud-btn" id="hudFullscreenBtn" type="button" title="Toggle Fullscreen (F)" aria-label="Toggle Fullscreen">
      <svg id="hudExpandIcon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"></polyline>
        <polyline points="9 21 3 21 3 15"></polyline>
        <line x1="21" y1="3" x2="14" y2="10"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
      <svg id="hudShrinkIcon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
        <polyline points="4 14 10 14 10 20"></polyline>
        <polyline points="20 10 14 10 14 4"></polyline>
        <line x1="14" y1="10" x2="21" y2="3"></line>
        <line x1="3" y1="21" x2="10" y2="14"></line>
      </svg>
    </button>
  `;

  document.body.appendChild(hud);
}

/**
 * Injects the middle-right Quick Action stack (Explode, Default, Simulator).
 */
function createActionStackMarkup(viewerState) {
  const existing = document.getElementById("viewerActionStack");
  if (existing) existing.remove();

  const stack = document.createElement("nav");
  stack.id = "viewerActionStack";
  stack.className = "viewer-action-stack";
  stack.setAttribute("aria-label", "Scene Actions");

  stack.innerHTML = `
    <!-- 1. Explode Button -->
    <button id="hudExplodeBtn" class="hud-action-btn" type="button" title="Explode View (Toggle parts separation)" aria-label="Explode View">
      <svg class="hud-action-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21 16-4 4-4-4"></path>
        <path d="M17 20V4"></path>
        <path d="m3 8 4-4 4 4"></path>
        <path d="M7 4v16"></path>
      </svg>
      <span class="hud-action-label">Explode</span>
    </button>

    <!-- 2. Default View Button -->
    <button id="hudDefaultViewBtn" class="hud-action-btn" type="button" title="Reset to Default Scene View" aria-label="Default View">
      <svg class="hud-action-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      <span class="hud-action-label">Default</span>
    </button>

    <!-- 3. Simulator Button -->
    <button id="hudSimulatorBtn" class="hud-action-btn" type="button" title="Toggle Interactive Feature Simulator" aria-label="Simulator">
      <svg class="hud-action-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span class="hud-action-label">Simulator</span>
    </button>
  `;

  document.body.appendChild(stack);
}

/**
 * Injects the bottom-right Environment Preset Selector pills.
 */
function createEnvironmentSelectorMarkup(viewerState) {
  const existing = document.getElementById("viewerEnvSelector");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "viewerEnvSelector";
  container.className = "viewer-env-selector";
  container.setAttribute("aria-label", "Environment Lighting Selector");

  container.innerHTML = `
    <div class="env-group">
      <button type="button" class="env-btn active" data-preset="studio_small_09" title="Studio Lighting" aria-label="Studio Lighting">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
        </svg>
        <span class="env-tooltip">Studio</span>
      </button>
      <button type="button" class="env-btn" data-preset="potsdamer_platz" title="Urban Outdoor Lighting" aria-label="Urban Lighting">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18M5 21V7l8-4v18M13 10h4v11"></path>
        </svg>
        <span class="env-tooltip">Urban</span>
      </button>
      <button type="button" class="env-btn" data-preset="autumn_ground" title="Nature Warm Lighting" aria-label="Nature Lighting">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a9 9 0 0 1 9 9c0 5-4 9-9 9s-9-4-9-9a9 9 0 0 1 9-9z"></path>
        </svg>
        <span class="env-tooltip">Nature</span>
      </button>
      <button type="button" class="env-btn" data-preset="aircraft_workshop" title="Industrial High-Contrast Lighting" aria-label="Industrial Lighting">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 20h20M7 20v-6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6"></path>
        </svg>
        <span class="env-tooltip">Industrial</span>
      </button>
    </div>
  `;

  document.body.appendChild(container);
}

/**
 * Binds Environment preset button clicks.
 */
function bindEnvironmentSelectorActions(viewerState) {
  const container = document.getElementById("viewerEnvSelector");
  if (!container) return;

  const buttons = container.querySelectorAll(".env-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetKey = btn.getAttribute("data-preset");
      if (presetKey) {
        setEnvironmentPreset(viewerState, presetKey);
      }
    });
  });
}

/**
 * Binds event listeners for HUD buttons (Reset, Turntable, Speed, Fullscreen).
 */
function bindHUDActions(viewerState) {
  const resetBtn = document.getElementById("hudResetBtn");
  const turntableBtn = document.getElementById("hudTurntableBtn");
  const speedBtn = document.getElementById("hudSpeedBtn");
  const fullscreenBtn = document.getElementById("hudFullscreenBtn");

  resetBtn?.addEventListener("click", () => resetViewerCamera(viewerState));
  turntableBtn?.addEventListener("click", () => toggleAutoRotate(viewerState));
  speedBtn?.addEventListener("click", () => cycleTurntableSpeed(viewerState));
  fullscreenBtn?.addEventListener("click", () => toggleFullscreen());
}

/**
 * Binds event listeners for Exploded view, Default view, and Simulator actions.
 */
function bindActionStackEvents(viewerState) {
  const explodeBtn = document.getElementById("hudExplodeBtn");
  const defaultBtn = document.getElementById("hudDefaultViewBtn");
  const simulatorBtn = document.getElementById("hudSimulatorBtn");

  explodeBtn?.addEventListener("click", () => toggleExplodedView(viewerState));

  defaultBtn?.addEventListener("click", () => {
    resetViewerCamera(viewerState);
    if (viewerState._isExploded) toggleExplodedView(viewerState);
  });

  simulatorBtn?.addEventListener("click", () => toggleSimulator(viewerState));
}

/**
 * Resets camera orientation and framing to fit the loaded 3D model.
 */
export function resetViewerCamera(viewerState) {
  if (viewerState.cameraRig && viewerState.currentModel) {
    viewerState.cameraRig.fitToObject(viewerState.currentModel, 1.35);
  }
}

/**
 * Toggles continuous 360° turntable rotation.
 */
export function toggleAutoRotate(viewerState, forceState = null) {
  if (!viewerState.cameraRig) return;

  const willRotate = forceState !== null ? forceState : !viewerState.cameraRig.autoRotate;
  viewerState.cameraRig.autoRotate = willRotate;

  const currentSpeed = SPEED_MULTIPLIERS[viewerState._currentSpeedIndex || 1].value;
  viewerState.cameraRig.autoRotateSpeed = BASE_AUTOROTATE_SPEED * currentSpeed;

  const playIcon = document.getElementById("hudPlayIcon");
  const pauseIcon = document.getElementById("hudPauseIcon");
  const turntableBtn = document.getElementById("hudTurntableBtn");

  if (willRotate) {
    playIcon?.style.setProperty("display", "none");
    pauseIcon?.style.setProperty("display", "block");
    turntableBtn?.classList.add("active");
  } else {
    playIcon?.style.setProperty("display", "block");
    pauseIcon?.style.setProperty("display", "none");
    turntableBtn?.classList.remove("active");
  }
}

/**
 * Cycles turntable speed (0.5x, 1x, 1.5x, 2x, 3x).
 */
export function cycleTurntableSpeed(viewerState) {
  viewerState._currentSpeedIndex =
    ((viewerState._currentSpeedIndex ?? 1) + 1) % SPEED_MULTIPLIERS.length;
  applyCurrentSpeed(viewerState);
}

/**
 * Sets turntable speed multiplier directly (e.g., "1.5x" or 1.5).
 */
export function setTurntableSpeed(viewerState, speedValue) {
  const speedStr = String(speedValue).toLowerCase().replace(/x$/, "") + "x";
  const idx = SPEED_MULTIPLIERS.findIndex((s) => s.label === speedStr || s.value === Number(speedValue));
  if (idx !== -1) {
    viewerState._currentSpeedIndex = idx;
    applyCurrentSpeed(viewerState);
  }
}

function applyCurrentSpeed(viewerState) {
  const current = SPEED_MULTIPLIERS[viewerState._currentSpeedIndex || 1];
  const label = document.getElementById("hudSpeedLabel");
  if (label) label.textContent = current.label;

  if (viewerState.cameraRig && viewerState.cameraRig.autoRotate) {
    viewerState.cameraRig.autoRotateSpeed = BASE_AUTOROTATE_SPEED * current.value;
  }
}

/**
 * Smoothly animates meshes outward from the model center to produce an exploded view.
 */
export function toggleExplodedView(viewerState) {
  if (!viewerState.currentModel) return;

  viewerState._isExploded = !viewerState._isExploded;
  const explodeBtn = document.getElementById("hudExplodeBtn");
  if (explodeBtn) {
    explodeBtn.classList.toggle("active", viewerState._isExploded);
  }

  const model = viewerState.currentModel;
  const originalTransforms = viewerState._originalMeshTransforms;

  // Calculate center of whole model
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const meshes = [];
  model.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });

  if (meshes.length === 0) return;

  const duration = 600; // ms
  const startTime = performance.now();

  const startPositions = new Map();
  const targetPositions = new Map();

  meshes.forEach((mesh) => {
    if (!originalTransforms.has(mesh.uuid)) {
      originalTransforms.set(mesh.uuid, mesh.position.clone());
    }

    const origPos = originalTransforms.get(mesh.uuid);
    startPositions.set(mesh.uuid, mesh.position.clone());

    if (viewerState._isExploded) {
      // Explode along vector from center
      const meshBox = new THREE.Box3().setFromObject(mesh);
      const meshCenter = new THREE.Vector3();
      meshBox.getCenter(meshCenter);

      const dir = new THREE.Vector3().subVectors(meshCenter, center);
      if (dir.lengthSq() < 0.0001) {
        dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      }
      dir.normalize();

      const explodeDistance = maxDim * 0.45;
      const targetPos = origPos.clone().addScaledVector(dir, explodeDistance);
      targetPositions.set(mesh.uuid, targetPos);
    } else {
      // Collapse back to original position
      targetPositions.set(mesh.uuid, origPos.clone());
    }
  });

  const animateExplosion = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Cubic ease-out
    const ease = 1 - Math.pow(1 - progress, 3);

    meshes.forEach((mesh) => {
      const s = startPositions.get(mesh.uuid);
      const t = targetPositions.get(mesh.uuid);
      if (s && t) {
        mesh.position.lerpVectors(s, t, ease);
      }
    });

    if (progress < 1) {
      requestAnimationFrame(animateExplosion);
    }
  };

  requestAnimationFrame(animateExplosion);
}

/**
 * Toggles simulator mode, executing external hooks and emitting postMessage.
 */
export function toggleSimulator(viewerState) {
  viewerState._isSimulating = !viewerState._isSimulating;
  const btn = document.getElementById("hudSimulatorBtn");
  if (btn) btn.classList.toggle("active", viewerState._isSimulating);

  const modelName = viewerState.currentModel?.name || "Product";

  // Check for custom host callback function
  try {
    if (typeof window.onSimulatorToggle === "function") {
      window.onSimulatorToggle({ active: viewerState._isSimulating, modelName });
    }
  } catch (err) {
    console.warn("Error in window.onSimulatorToggle:", err);
  }

  // PostMessage to parent window
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "SIMULATOR_TOGGLE",
          active: viewerState._isSimulating,
          modelName
        },
        "*"
      );
    }
  } catch (_) {}
}

/**
 * Updates the HDR Environment preset.
 */
export function setEnvironmentPreset(viewerState, presetKey) {
  if (viewerState.environmentManager) {
    viewerState.environmentManager.loadEnvironment(presetKey);
  }
  const container = document.getElementById("viewerEnvSelector");
  if (container) {
    const buttons = container.querySelectorAll(".env-btn");
    buttons.forEach((b) => {
      const match = b.getAttribute("data-preset") === presetKey;
      b.classList.toggle("active", match);
    });
  }
}

/**
 * Updates the title and metadata inside the HUD pill.
 */
export function updateHudSceneInfo(viewerState, customTitle = null) {
  const titleEl = document.getElementById("hudSceneTitle");
  if (!titleEl) return;

  const title =
    customTitle ||
    viewerState.sceneDocument?.metadata?.title ||
    viewerState.currentModel?.name ||
    "Product Showcase";

  titleEl.textContent = title;
}

/**
 * Toggles Fullscreen API.
 */
export function toggleFullscreen() {
  const expandIcon = document.getElementById("hudExpandIcon");
  const shrinkIcon = document.getElementById("hudShrinkIcon");

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    expandIcon?.style.setProperty("display", "none");
    shrinkIcon?.style.setProperty("display", "block");
  } else {
    document.exitFullscreen().catch(() => {});
    expandIcon?.style.setProperty("display", "block");
    shrinkIcon?.style.setProperty("display", "none");
  }
}

/**
 * Sets up 3.5s inactivity timer that fades out UI chrome unless hovered.
 */
function setupInactivityAutoHide(viewerState) {
  const header = document.getElementById("viewerHeader");
  const hud = document.getElementById("viewerHud");
  const actionStack = document.getElementById("viewerActionStack");
  const envSelector = document.getElementById("viewerEnvSelector");

  const resetTimer = () => {
    setChromeVisible(true);

    if (viewerState.inactivityTimer) {
      clearTimeout(viewerState.inactivityTimer);
      viewerState.inactivityTimer = null;
    }

    if (viewerState.isChromeHovered) return;

    viewerState.inactivityTimer = setTimeout(() => {
      if (!viewerState.isChromeHovered) {
        setChromeVisible(false);
      }
    }, viewerState.inactivityThresholdMs || 3500);
  };

  [header, hud, actionStack, envSelector].forEach((el) => {
    if (!el) return;
    el.addEventListener("mouseenter", () => {
      viewerState.isChromeHovered = true;
      setChromeVisible(true);
      if (viewerState.inactivityTimer) clearTimeout(viewerState.inactivityTimer);
    });

    el.addEventListener("mouseleave", () => {
      viewerState.isChromeHovered = false;
      resetTimer();
    });
  });

  const events = ["pointermove", "pointerdown", "touchstart", "touchmove", "wheel", "keydown"];
  events.forEach((evt) => {
    window.addEventListener(evt, resetTimer, { passive: true });
  });

  resetTimer();
}

/**
 * Toggles chrome visibility CSS class.
 */
export function setChromeVisible(visible) {
  const header = document.getElementById("viewerHeader");
  const hud = document.getElementById("viewerHud");
  const actionStack = document.getElementById("viewerActionStack");
  const envSelector = document.getElementById("viewerEnvSelector");

  const elements = [header, hud, actionStack, envSelector];
  elements.forEach((el) => {
    if (!el) return;
    if (visible) {
      el.classList.remove("viewer-chrome-hidden");
    } else {
      el.classList.add("viewer-chrome-hidden");
    }
  });
}

/**
 * Sets up global keyboard shortcuts.
 */
function setupKeyboardShortcuts(viewerState) {
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    switch (e.code) {
      case "Space":
        e.preventDefault();
        toggleAutoRotate(viewerState);
        break;

      case "KeyR":
        e.preventDefault();
        resetViewerCamera(viewerState);
        break;

      case "KeyF":
        e.preventDefault();
        toggleFullscreen();
        break;

      case "KeyB":
        e.preventDefault();
        if (viewerState.bloomManager) {
          viewerState.bloom.enabled = !viewerState.bloom.enabled;
          viewerState.bloomManager.setEnabled(viewerState.bloom.enabled);
        }
        break;

      case "Escape":
        viewerState.hotspots?.forEach((h) => {
          if (h.panel) h.panel.classList.remove("visible");
        });
        break;
    }
  });
}
