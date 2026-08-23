import * as THREE from "three";

import { clearSelection, state } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { initializeGizmo } from "../gizmo/gizmo.js";
import { initializeHierarchy, renderHierarchy } from "../hierarchy/hierarchy.js";
import { initializeInspector, renderInspector } from "../inspector/inspector.js";
import {
  createHotspot,
  removeHotspot,
  updateHotspots
} from "../hotspots/hotspots.js";
import {
  applyLightingPreset,
  bindLightUI,
  deleteSelectedLight,
  updateLights
} from "../lights/lights.js";
import { bindIO } from "../io/io.js";
import { bindUI, showSidebarTab } from "../ui/ui.js";
import {
  applyBackgroundSettings,
  applyEnvironmentParams,
  loadEnvironment,
  resizeRenderer,
  setAxesVisible,
  setGridVisible,
  setShadowsEnabled,
  startAnimation
} from "../render/render.js";

function syncEnvironmentTabUI() {
  const env = state.sceneSettings?.environment || {};
  const presetSelect = document.getElementById("envTabPreset");
  if (presetSelect && env.preset) presetSelect.value = env.preset;

  const intensityInput = document.getElementById("envTabIntensity");
  const intensityVal = document.getElementById("envTabIntensityVal");
  if (intensityInput) {
    const val = env.intensity ?? 1.0;
    intensityInput.value = val;
    if (intensityVal) intensityVal.textContent = Number(val).toFixed(1);
  }

  const rotInput = document.getElementById("envTabRotation");
  const rotVal = document.getElementById("envTabRotationVal");
  if (rotInput) {
    const val = env.rotation ?? 0;
    rotInput.value = val;
    if (rotVal) rotVal.textContent = `${Math.round(val)}°`;
  }

  const bgTypeSelect = document.getElementById("envTabBgType");
  const bgColorRow = document.getElementById("envTabBgColorRow");
  const bgBlurRow = document.getElementById("envTabBgBlurRow");
  if (bgTypeSelect) {
    const bgType = state.sceneSettings.backgroundType || "color";
    bgTypeSelect.value = bgType;
    if (bgColorRow) bgColorRow.style.display = bgType === "transparent" ? "none" : "flex";
    if (bgBlurRow) bgBlurRow.style.display = bgType === "environment" ? "block" : "none";
  }

  const bgColorInput = document.getElementById("envTabBgColor");
  if (bgColorInput && state.sceneSettings.background) {
    bgColorInput.value = state.sceneSettings.background;
  }

  const bgBlurInput = document.getElementById("envTabBgBlur");
  const bgBlurVal = document.getElementById("envTabBgBlurVal");
  if (bgBlurInput) {
    const val = state.sceneSettings.backgroundBlur || 0;
    bgBlurInput.value = val;
    if (bgBlurVal) bgBlurVal.textContent = Number(val).toFixed(2);
  }

  const toneSelect = document.getElementById("envTabToneMapping");
  if (toneSelect && env.toneMapping) {
    toneSelect.value = env.toneMapping;
  }

  const expInput = document.getElementById("envTabExposure");
  const expVal = document.getElementById("envTabExposureVal");
  if (expInput) {
    const val = env.exposure ?? 1.6;
    expInput.value = val;
    if (expVal) expVal.textContent = Number(val).toFixed(1);
  }

  const shadowsCheck = document.getElementById("envTabShadows");
  if (shadowsCheck) {
    shadowsCheck.checked = state.sceneSettings.rendering?.shadows !== false;
  }

  const gridCheck = document.getElementById("envTabGrid");
  if (gridCheck) {
    gridCheck.checked = state.sceneSettings.helpers?.grid !== false;
  }

  const axesCheck = document.getElementById("envTabAxes");
  if (axesCheck) {
    axesCheck.checked = Boolean(state.sceneSettings.helpers?.axes);
  }
}

function bindEnvironmentTab() {
  window.addEventListener("editorselectionchange", syncEnvironmentTabUI);
  const scene = state.scene;
  const renderer = state.renderer;

  // Preset
  const presetSelect = document.getElementById("envTabPreset");
  if (presetSelect) {
    presetSelect.value = state.sceneSettings.environment?.preset || "studio_small_09";
    presetSelect.addEventListener("change", (e) => {
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.preset = e.target.value;
      loadEnvironment(e.target.value);
    });
  }

  // Intensity
  const intensityInput = document.getElementById("envTabIntensity");
  const intensityVal = document.getElementById("envTabIntensityVal");
  if (intensityInput) {
    intensityInput.value = state.sceneSettings.environment?.intensity ?? 1.0;
    intensityInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (intensityVal) intensityVal.textContent = val.toFixed(1);
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.intensity = val;
      applyEnvironmentParams();
    });
  }

  // Rotation
  const rotInput = document.getElementById("envTabRotation");
  const rotVal = document.getElementById("envTabRotationVal");
  if (rotInput) {
    rotInput.value = state.sceneSettings.environment?.rotation ?? 0;
    rotInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (rotVal) rotVal.textContent = `${Math.round(val)}°`;
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.rotation = val;
      applyEnvironmentParams();
    });
  }

  // Background Mode
  const bgTypeSelect = document.getElementById("envTabBgType");
  const bgColorRow = document.getElementById("envTabBgColorRow");
  const bgBlurRow = document.getElementById("envTabBgBlurRow");
  if (bgTypeSelect) {
    bgTypeSelect.value = state.sceneSettings.backgroundType || "color";
    bgTypeSelect.addEventListener("change", (e) => {
      state.sceneSettings.backgroundType = e.target.value;
      if (bgColorRow) bgColorRow.style.display = e.target.value === "transparent" ? "none" : "flex";
      if (bgBlurRow) bgBlurRow.style.display = e.target.value === "environment" ? "block" : "none";
      applyBackgroundSettings();
    });
  }

  // Background Color
  const bgColorInput = document.getElementById("envTabBgColor");
  if (bgColorInput) {
    bgColorInput.value = state.sceneSettings.background || "#222228";
    bgColorInput.addEventListener("input", (e) => {
      state.sceneSettings.background = e.target.value;
      applyBackgroundSettings();
    });
  }

  // Background Blur
  const bgBlurInput = document.getElementById("envTabBgBlur");
  const bgBlurVal = document.getElementById("envTabBgBlurVal");
  if (bgBlurInput) {
    bgBlurInput.value = state.sceneSettings.backgroundBlur || 0;
    bgBlurInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (bgBlurVal) bgBlurVal.textContent = val.toFixed(2);
      state.sceneSettings.backgroundBlur = val;
      applyBackgroundSettings();
    });
  }

  // Tone Mapping
  const toneSelect = document.getElementById("envTabToneMapping");
  if (toneSelect) {
    toneSelect.value = state.sceneSettings.environment?.toneMapping || "ACESFilmic";
    toneSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.toneMapping = val;
      if (renderer) {
        if (val === "Linear") renderer.toneMapping = THREE.LinearToneMapping;
        else if (val === "Reinhard") renderer.toneMapping = THREE.ReinhardToneMapping;
        else if (val === "Cineon") renderer.toneMapping = THREE.CineonToneMapping;
        else if (val === "AgX") renderer.toneMapping = THREE.AgXToneMapping;
        else renderer.toneMapping = THREE.ACESFilmicToneMapping;
      }
    });
  }

  // Exposure
  const expInput = document.getElementById("envTabExposure");
  const expVal = document.getElementById("envTabExposureVal");
  if (expInput) {
    expInput.value = state.sceneSettings.environment?.exposure ?? 1.6;
    expInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (expVal) expVal.textContent = val.toFixed(1);
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.exposure = val;
      if (renderer) renderer.toneMappingExposure = val;
    });
  }

  // Shadows
  const shadowsCheck = document.getElementById("envTabShadows");
  if (shadowsCheck) {
    shadowsCheck.checked = state.sceneSettings.rendering?.shadows !== false;
    shadowsCheck.addEventListener("change", (e) => {
      setShadowsEnabled(e.target.checked);
    });
  }

  // Grid
  const gridCheck = document.getElementById("envTabGrid");
  if (gridCheck) {
    gridCheck.checked = state.sceneSettings.helpers?.grid !== false;
    gridCheck.addEventListener("change", (e) => {
      setGridVisible(e.target.checked);
    });
  }

  // Axes
  const axesCheck = document.getElementById("envTabAxes");
  if (axesCheck) {
    axesCheck.checked = Boolean(state.sceneSettings.helpers?.axes);
    axesCheck.addEventListener("change", (e) => {
      setAxesVisible(e.target.checked);
    });
  }
}

function setAddMode(active) {
  state.addMode = active;
  state.currentMode = active ? "add-hotspot" : "idle";

  const addBtn = document.getElementById("addBtn");
  if (!addBtn) return;

  addBtn.textContent = active ? "Cancel" : "Add Hotspot";
  addBtn.classList.toggle("active", active);
}

function initializeEditor(loader) {
  state.viewport = state.viewport || document.getElementById("viewport");
  state.overlay = state.overlay || document.getElementById("overlay");
  state.hotspotLines = state.hotspotLines || document.getElementById("hotspotLines");

  state.hotspots = state.hotspots || [];
  state.lights = state.lights || [];
  clearSelection();
  state.addMode = false;
  state.currentMode = "idle";
  state.draggingHotspot = false;
  state.importedJsonFileName = state.importedJsonFileName || "hotspots.json";

  const scene = state.scene;
  const camera = state.camera;
  const renderer = state.renderer;
  const viewport = state.viewport;
  const raycaster = state.raycaster || new THREE.Raycaster();
  const mouse = state.mouse || new THREE.Vector2();

  state.raycaster = raycaster;
  state.mouse = mouse;

  // Background color listener
  const bgColorInput = document.getElementById("backgroundColor");
  if (bgColorInput) {
    bgColorInput.addEventListener("input", (e) => {
      state.sceneSettings.background = e.target.value;
      if (scene) scene.background = new THREE.Color(state.sceneSettings.background);
    });
  }

  const sidebar = state.sidebar || document.getElementById("sidebar");
  const toggleSidebarBtn = state.toggleSidebarBtn || document.getElementById("toggleSidebarBtn");

  if (sidebar) state.sidebar = sidebar;
  if (toggleSidebarBtn) state.toggleSidebarBtn = toggleSidebarBtn;

  // Core subsystems
  bindUI();
  bindIO(loader);
  bindLightUI();
  bindEnvironmentTab();

  // Phase 2 Modules
  initializeGizmo();
  initializeHierarchy();
  initializeInspector();

  // Camera Axis Snapping UI Listeners
  document.querySelectorAll(".camera-axis-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const axis = btn.getAttribute("data-axis");
      if (state.cameraRig && axis) {
        state.cameraRig.snapToAxis(axis);
      }
    });
  });

  // Studio Lighting Preset Buttons (Global delegation for sidebar and dynamic inspector)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".light-preset-btn");
    if (btn) {
      const preset = btn.getAttribute("data-preset");
      if (preset) {
        applyLightingPreset(preset);
      }
    }
  });

  const frameHandler = () => {
    if (state.cameraRig && state.currentModel) {
      state.cameraRig.focus(state.currentModel);
    }
  };

  const resetViewHandler = () => {
    if (state.cameraRig) {
      state.cameraRig.reset();
    }
  };

  document.getElementById("resetCamViewBtn")?.addEventListener("click", resetViewHandler);
  document.getElementById("sidebarFrameModelBtn")?.addEventListener("click", frameHandler);

  document.getElementById("sidebarSetDefaultCamBtn")?.addEventListener("click", () => {
    if (state.cameraRig) {
      const camState = state.cameraRig.getState();
      state.cameraRig.setDefaultState(camState);
      if (!state.sceneDocument) state.sceneDocument = {};
      state.sceneDocument.camera = {
        yaw: camState.yaw,
        pitch: camState.pitch,
        distance: camState.distance,
        minDistance: state.cameraRig.minDistance,
        maxDistance: state.cameraRig.maxDistance,
        target: camState.target,
        fov: camState.fov
      };
      const btn = document.getElementById("sidebarSetDefaultCamBtn");
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "&#10003; Default Saved!";
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
      }
    }
  });

  document.getElementById("sidebarResetDefaultCamBtn")?.addEventListener("click", () => {
    if (state.cameraRig) {
      state.cameraRig.reset();
    }
  });

  // Hotspot add button
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      setAddMode(!state.addMode);
    };
  }

  // Track pointer down coordinates to distinguish between camera orbit drags and single clicks
  let pointerDownPos = { x: 0, y: 0 };

  renderer.domElement.addEventListener("pointerdown", (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  // Universal Click Selection & Hotspot Creation
  renderer.domElement.addEventListener("click", (e) => {
    // If dragging a hotspot or transforming with gizmo, ignore click
    if (state.draggingHotspot || state.transformControls?.dragging) return;

    // Distinguish between camera orbit/rotate drag and a single click
    const dragDistance = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dragDistance > 5) {
      // User was rotating the object or panning the camera; preserve current selection
      return;
    }

    mouse.x = (e.offsetX / viewport.clientWidth) * 2 - 1;
    mouse.y = -(e.offsetY / viewport.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 1. Check Light Sprites
    const lightSprites = state.lights.map((l) => l.lightSprite).filter(Boolean);
    const lightHits = raycaster.intersectObjects(lightSprites);

    if (lightHits.length) {
      const lightData = state.lights.find((l) => l.lightSprite === lightHits[0].object);
      if (lightData) {
        select("light", lightData);
        showSidebarTab("properties");
        return;
      }
    }

    // 2. Check Light Target Sprites
    const targetSprites = state.lights.map((l) => l.targetSprite).filter(Boolean);
    const targetHits = raycaster.intersectObjects(targetSprites);

    if (targetHits.length) {
      const lightData = state.lights.find((l) => l.targetSprite === targetHits[0].object);
      if (lightData) {
        select("lightTarget", lightData, lightData.target);
        showSidebarTab("properties");
        return;
      }
    }

    // 3. Check Current Model
    const intersects = state.currentModel
      ? raycaster.intersectObject(state.currentModel, true)
      : [];

    if (state.addMode) {
      if (intersects.length) {
        const point = intersects[0].point;
        createHotspot(point);
        setAddMode(false);
        renderHierarchy();
        return;
      }

      setAddMode(false);
      return;
    }

    // 4. If single click was directly on the 3D model, keep the currently selected object active
    if (intersects.length > 0) {
      return;
    }

    // 5. Only deselect when single clicking outside of the 3D model (empty space)
    if (lightHits.length === 0 && targetHits.length === 0) {
      deselect();
    }
  });

  // Global delete key handler
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (state.selection?.type === "hotspot" && state.selection.object) {
        removeHotspot(state.selection.object);
        deselect("hotspot");
        renderHierarchy();
      } else if (state.selection?.type === "light" && state.selection.object) {
        deleteSelectedLight();
        deselect("light");
        renderHierarchy();
      }
    }

    // Camera view shortcuts
    if (state.cameraRig) {
      if (e.code === "Numpad1" || e.code === "Digit1") {
        e.preventDefault();
        state.cameraRig.snapToAxis(e.ctrlKey || e.altKey || e.shiftKey ? "back" : "front");
      } else if (e.code === "Numpad3" || e.code === "Digit3") {
        e.preventDefault();
        state.cameraRig.snapToAxis(e.ctrlKey || e.altKey || e.shiftKey ? "left" : "right");
      } else if (e.code === "Numpad7" || e.code === "Digit7") {
        e.preventDefault();
        state.cameraRig.snapToAxis(e.ctrlKey || e.altKey || e.shiftKey ? "bottom" : "top");
      } else if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey) {
        if (state.currentModel) {
          state.cameraRig.focus(state.currentModel);
        }
      }
    }
  });

  function animateFrame() {
    updateHotspots();
    updateLights();
  }

  startAnimation(animateFrame);

  // Responsive resizing via window and container ResizeObserver
  window.addEventListener("resize", () => {
    resizeRenderer();
  });

  if (window.ResizeObserver && state.viewport) {
    const resizeObserver = new ResizeObserver(() => {
      resizeRenderer();
    });
    resizeObserver.observe(state.viewport);
  }
}

export { initializeEditor, syncEnvironmentTabUI };
