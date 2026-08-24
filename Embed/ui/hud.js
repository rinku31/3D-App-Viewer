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

/**
 * Initializes the Viewer HUD overlay, event handlers, keyboard shortcuts,
 * environment preset selector, and auto-hide inactivity controller.
 */
export function initializeViewerHUD() {
  createHUDMarkup();
  createEnvironmentSelectorMarkup();
  createLoadingOverlayMarkup();
  bindHUDActions();
  bindEnvironmentSelectorActions();
  setupInactivityAutoHide();
  setupKeyboardShortcuts();
  updateHudSceneInfo();
}

/**
 * Injects the bottom-right Environment Option selector into the DOM.
 */
function createEnvironmentSelectorMarkup() {
  const existing = document.getElementById("viewerEnvSelector");
  if (existing) existing.remove();

  const envContainer = document.createElement("nav");
  envContainer.id = "viewerEnvSelector";
  envContainer.className = "viewer-env-selector";
  envContainer.setAttribute("aria-label", "Lighting Environment Selector");

  envContainer.innerHTML = `
    <div class="env-group" role="toolbar" aria-label="Environment Presets">
      <!-- 1. Balance (Studio Small 09) -->
      <button class="env-btn active" data-preset="studio_small_09" data-name="Balance" type="button" aria-label="Balance Environment" title="Balance Environment">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <span class="env-tooltip">Balance</span>
      </button>

      <!-- 2. Urban (Potsdamer Platz) -->
      <button class="env-btn" data-preset="potsdamer_platz" data-name="Urban" type="button" aria-label="Urban Environment" title="Urban Environment">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"></path>
          <path d="M5 21V7l8-4v18"></path>
          <path d="M19 21V11l-6-4"></path>
          <path d="M9 9h1"></path>
          <path d="M9 13h1"></path>
          <path d="M9 17h1"></path>
        </svg>
        <span class="env-tooltip">Urban</span>
      </button>

      <!-- 3. Nature (Autumn Park) -->
      <button class="env-btn" data-preset="autumn_ground" data-name="Nature" type="button" aria-label="Nature Environment" title="Nature Environment">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
        </svg>
        <span class="env-tooltip">Nature</span>
      </button>

      <!-- 4. Industrial (Aircraft Workshop) -->
      <button class="env-btn" data-preset="aircraft_workshop" data-name="Industrial" type="button" aria-label="Industrial Environment" title="Industrial Environment">
        <svg class="env-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
          <path d="M17 18h1"></path>
          <path d="M12 18h1"></path>
          <path d="M7 18h1"></path>
        </svg>
        <span class="env-tooltip">Industrial</span>
      </button>
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
 * Binds click events to switch environment HDR presets.
 */
function bindEnvironmentSelectorActions() {
  const container = document.getElementById("viewerEnvSelector");
  if (!container) return;

  container.querySelectorAll(".env-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const preset = btn.getAttribute("data-preset");
      if (!preset || !state.environmentManager) return;

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
 * Updates the active visual indicator for environment preset buttons.
 */
export function updateActiveEnvButton(activePreset) {
  const container = document.getElementById("viewerEnvSelector");
  if (!container) return;

  const normalized = activePreset === "balance" ? "studio_small_09"
    : activePreset === "urban" ? "potsdamer_platz"
    : activePreset === "nature" ? "autumn_ground"
    : activePreset === "industrial" ? "aircraft_workshop"
    : activePreset;

  container.querySelectorAll(".env-btn").forEach((btn) => {
    const isTarget = btn.getAttribute("data-preset") === normalized;
    btn.classList.toggle("active", isTarget);
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
    <!-- 1. Brand / Title Pill with Dynamic Long-Name Tooltip -->
    <div class="hud-item hud-brand" id="hudBrandBadge" tabindex="0" role="status" aria-label="Current Product">
      <span class="hud-brand-dot"></span>
      <span class="hud-brand-text" id="hudSceneTitle">Product Showcase</span>
      <div class="hud-brand-tooltip" id="hudBrandTooltip" role="tooltip" aria-hidden="true">
        <span class="hud-brand-tooltip-text" id="hudBrandTooltipText">Product Showcase</span>
        <span class="hud-brand-tooltip-arrow"></span>
      </div>
    </div>

    <div class="hud-divider"></div>

    <!-- 2. Controls Group: Reset, Play/Pause Turntable, Speed Multiplier, Bloom, Fullscreen -->
    <div class="hud-group" role="toolbar" aria-label="Scene Controls">
      <!-- Reset Camera View -->
      <button id="hudResetViewBtn" class="hud-btn" type="button" title="Reset View [Key: R]" aria-label="Reset Camera View">
        <svg class="hud-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        <span class="hud-btn-label">Reset</span>
      </button>

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

      <!-- Bloom Glow Toggle Button -->
      <button id="hudBloomBtn" class="hud-btn" type="button" title="Toggle Bloom Glow [Key: B]" aria-label="Toggle Bloom Glow">
        <svg id="hudBloomIcon" class="hud-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <span id="hudBloomLabel" class="hud-btn-label">Bloom</span>
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

  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleEmbedBloom();
    });
  }

  const fullscreenBtn = document.getElementById("hudFullscreenBtn");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  // Mobile / keyboard tap on brand badge to toggle tooltip if long
  const brandBadge = document.getElementById("hudBrandBadge");
  if (brandBadge) {
    brandBadge.addEventListener("click", (e) => {
      if (brandBadge.classList.contains("has-long-title")) {
        brandBadge.classList.toggle("tooltip-active");
      }
    });
  }

  document.addEventListener("fullscreenchange", updateFullscreenUIState);
  document.addEventListener("webkitfullscreenchange", updateFullscreenUIState);

  // Canvas click to deselect active hotspot panels
  const rendererDom = state.renderer?.domElement;
  if (rendererDom) {
    rendererDom.addEventListener("click", () => {
      if (brandBadge) brandBadge.classList.remove("tooltip-active");
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
 * Toggles Bloom Glow post-processing on/off in the Embed viewer
 */
export function toggleEmbedBloom() {
  const current = Boolean(state.bloom?.enabled);
  const next = !current;
  setEmbedBloomEnabled(next);

  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.classList.toggle("active", next);
    bloomBtn.classList.add("btn-pulsed");
    setTimeout(() => bloomBtn.classList.remove("btn-pulsed"), 400);
  }
}

/**
 * Updates the Scene Title displayed on the HUD brand pill.
 * Automatically activates rich tooltip if the name is truncated or long.
 */
export function updateHudSceneInfo(title) {
  const titleEl = document.getElementById("hudSceneTitle");
  const brandBadge = document.getElementById("hudBrandBadge");
  const tooltip = document.getElementById("hudBrandTooltip");
  const tooltipText = document.getElementById("hudBrandTooltipText");

  const raw = title
    || state.sceneDocument?.metadata?.title
    || state.currentModel?.name
    || "Product Showcase";

  // Clean title
  const resolved = String(raw).replace(/\s+Scene$/i, "").trim() || "Product Showcase";

  if (titleEl) {
    titleEl.textContent = resolved;
  }
  if (tooltipText) {
    tooltipText.textContent = resolved;
  }

  // Check if product name overflows / is long
  if (brandBadge && titleEl) {
    // Request animation frame or immediate measure
    requestAnimationFrame(() => {
      const isOverflowing = titleEl.scrollWidth > titleEl.clientWidth || resolved.length >= 14;
      if (isOverflowing) {
        brandBadge.classList.add("has-long-title");
        brandBadge.setAttribute("title", resolved);
        brandBadge.setAttribute("aria-label", `Current Product: ${resolved}`);
        if (tooltip) tooltip.setAttribute("aria-hidden", "false");
      } else {
        brandBadge.classList.remove("has-long-title");
        brandBadge.classList.remove("tooltip-active");
        brandBadge.removeAttribute("title");
        brandBadge.setAttribute("aria-label", `Current Product: ${resolved}`);
        if (tooltip) tooltip.setAttribute("aria-hidden", "true");
      }
    });
  }

  // Sync active environment preset indicator
  const activePreset = state.sceneDocument?.scene?.environment?.preset || state.environmentManager?.getCurrentPreset() || "studio_small_09";
  updateActiveEnvButton(activePreset);

  // Sync Bloom button active status
  const bloomBtn = document.getElementById("hudBloomBtn");
  if (bloomBtn) {
    bloomBtn.classList.toggle("active", Boolean(state.bloom?.enabled));
  }
}

/**
 * Smoothly resets the CameraRig to its default viewing angle and focus distance,
 * pauses turntable auto-rotation, and dismisses active hotspot popups.
 */
export function resetViewerCamera() {
  if (!state.cameraRig) return;

  // 1. Pause 360 auto-rotation when resetting
  state.cameraRig.autoRotate = false;
  updateAutoRotateUIState(false);

  // 2. Smoothly reset camera orientation & distance
  state.cameraRig.reset();
  state.visibilityDirty = true;

  // 3. Dismiss active hotspot panels & markers
  if (state.hotspots) {
    state.hotspots.forEach((h) => {
      if (h.panel) h.panel.style.display = "none";
      if (h.line) h.line.style.display = "none";
      if (h.dot) h.dot.classList.remove("active");
      h.active = false;
    });
  }

  // 4. Pulse visual feedback on the reset button
  const resetBtn = document.getElementById("hudResetViewBtn");
  if (resetBtn) {
    resetBtn.classList.add("btn-pulsed");
    setTimeout(() => resetBtn.classList.remove("btn-pulsed"), 400);
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
    } else if (e.key === "b" || e.key === "B" || e.code === "KeyB") {
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

  [state.hud, state.envSelector].forEach((el) => {
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
  if (state.envSelector) state.envSelector.classList.remove("viewer-chrome-hidden");
}

function hideChrome() {
  if (state.isChromeHovered) return;
  if (state.hud) state.hud.classList.add("viewer-chrome-hidden");
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
