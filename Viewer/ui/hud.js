/**
 * Viewer Commercial HUD Module
 * Manages the floating control pill (Scene Title, Reset View, Play/Pause Turntable, Fullscreen),
 * inactivity chrome auto-hide, keyboard shortcuts, and touch interactions.
 */

import { state } from "../state/state.js";

const BASE_AUTOROTATE_SPEED = 0.016;
const SPEED_MULTIPLIERS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1.0 },
  { label: "1.5x", value: 1.5 },
  { label: "2x", value: 2.0 },
  { label: "3x", value: 3.0 }
];
let currentSpeedIndex = 1; // Default: 1x

/**
 * Initializes the Viewer HUD overlay, event handlers, keyboard shortcuts,
 * and auto-hide inactivity controller.
 */
export function initializeViewerHUD() {
  createHUDMarkup();
  bindHUDActions();
  setupInactivityAutoHide();
  setupKeyboardShortcuts();
  updateHudSceneInfo();
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

    <!-- 2. Controls Group: Reset, Play/Pause Turntable, Speed Multiplier, Fullscreen -->
    <div class="hud-group" role="toolbar" aria-label="Scene Controls">
      <!-- Reset Camera View -->
      <button id="hudResetViewBtn" class="hud-btn" type="button" title="Reset View (Default Camera) [Key: R]" aria-label="Reset Camera View">
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

  // 4. Fullscreen Toggle Button
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

  state.cameraRig.reset();

  // Close active hotspot info panels
  state.hotspots?.forEach((h) => {
    if (h.panel) h.panel.style.display = "none";
    if (h.line) h.line.style.display = "none";
    if (h.dot) h.dot.classList.remove("active");
    h.active = false;
  });

  const btn = document.getElementById("hudResetViewBtn");
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
 * Sanitizes and updates the product showcase title, removing trailing " Scene".
 */
export function updateHudSceneInfo() {
  const titleEl = document.getElementById("hudSceneTitle");
  if (!titleEl) return;

  let rawTitle = state.sceneDocument?.metadata?.title || state.currentModel?.name || "Viper V4 Pro";
  // Remove " Scene" suffix if present
  const cleanedTitle = rawTitle.replace(/\s+Scene$/i, "").trim() || "Product Showcase";

  titleEl.textContent = cleanedTitle;
}

/**
 * Compatibility alias for backward compatibility across loaders.
 */
export function refreshTourSteps() {
  updateHudSceneInfo();
}

/**
 * Sets up inactivity auto-hide for header and floating HUD.
 * Fades out overlay controls after 3.5s of inactivity unless hovered.
 */
function setupInactivityAutoHide() {
  const header = document.getElementById("viewerHeader");
  const hud = document.getElementById("viewerHud");

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
  [header, hud].forEach((el) => {
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

  if (visible) {
    header?.classList.remove("viewer-chrome-hidden");
    hud?.classList.remove("viewer-chrome-hidden");
  } else {
    header?.classList.add("viewer-chrome-hidden");
    hud?.classList.add("viewer-chrome-hidden");
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

      case "Escape":
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
