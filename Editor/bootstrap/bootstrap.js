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
  bindLightUI,
  deleteSelectedLight,
  updateLights
} from "../lights/lights.js";
import { bindIO } from "../io/io.js";
import { bindUI, showSidebarTab } from "../ui/ui.js";
import { resizeRenderer, startAnimation } from "../render/render.js";

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

  // Phase 2 Modules
  initializeGizmo();
  initializeHierarchy();
  initializeInspector();

  // Hotspot add button
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      setAddMode(!state.addMode);
    };
  }

  // Universal Click Selection & Hotspot Creation
  renderer.domElement.addEventListener("click", (e) => {
    // If dragging a hotspot or transforming with gizmo, ignore click
    if (state.draggingHotspot) return;

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

    // 4. Object selection in standard mode
    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      select("mesh", hitObject);
      return;
    }

    // 5. Empty space click -> deselect
    if (intersects.length === 0 && lightHits.length === 0 && targetHits.length === 0) {
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
  });

  function animateFrame() {
    updateHotspots();
    updateLights();
  }

  startAnimation(animateFrame);
  window.addEventListener("resize", () => {
    resizeRenderer();
  });
}

export { initializeEditor };
