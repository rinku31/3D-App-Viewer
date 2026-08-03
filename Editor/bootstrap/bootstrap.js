import * as THREE from "three";

import { state } from "../state/state.js";
import {
  createHotspot,
  deselectHotspot,
  removeHotspot,
  updateHotspots,
  updatePanelHTML
} from "../hotspots/hotspots.js";
import {
  bindLightUI,
  selectLight,
  updateLights
} from "../lights/lights.js";
import { bindIO } from "../io/io.js";
import { bindUI } from "../ui/ui.js";
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
  state.selected = null;
  state.selectedLight = null;
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

  document.getElementById("backgroundColor").addEventListener("input", (e) => {
    state.sceneSettings.background = e.target.value;
    scene.background = new THREE.Color(state.sceneSettings.background);
  });

  const sidebar = state.sidebar || document.getElementById("sidebar");
  const toggleSidebarBtn = state.toggleSidebarBtn || document.getElementById("toggleSidebarBtn");

  if (sidebar) {
    state.sidebar = sidebar;
  }

  if (toggleSidebarBtn) {
    state.toggleSidebarBtn = toggleSidebarBtn;
  }

  bindUI();
  bindIO(loader);
  bindLightUI();

  document.getElementById("addBtn").onclick = () => {
    setAddMode(!state.addMode);
  };

  renderer.domElement.addEventListener("click", (e) => {
    if (state.draggingHotspot) return;

    mouse.x = (e.offsetX / viewport.clientWidth) * 2 - 1;
    mouse.y = -(e.offsetY / viewport.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const lightSprites = state.lights.map((l) => l.lightSprite);
    const lightHits = raycaster.intersectObjects(lightSprites);

    if (lightHits.length) {
      const lightData = state.lights.find((l) => l.lightSprite === lightHits[0].object);
      selectLight(lightData);
      return;
    }

    const intersects = state.currentModel
      ? raycaster.intersectObject(state.currentModel, true)
      : [];

    if (state.addMode) {
      if (intersects.length) {
        const point = intersects[0].point;
        createHotspot(point);
        setAddMode(false);
        return;
      }

      setAddMode(false);
      return;
    }

    if (intersects.length === 0) {
      deselectHotspot();
    }
  });

  document.getElementById("titleInput").addEventListener("input", (e) => {
    if (!state.selected) return;

    state.selected.title = e.target.value;
    updatePanelHTML(state.selected, state.selected.panel);
  });

  document.getElementById("descInput").addEventListener("input", (e) => {
    if (!state.selected) return;

    state.selected.description = e.target.value;
    updatePanelHTML(state.selected, state.selected.panel);
  });

  document.getElementById("panelX").addEventListener("input", (e) => {
    if (!state.selected) return;
    state.selected.panelOffset.x = Number(e.target.value);
  });

  document.getElementById("panelY").addEventListener("input", (e) => {
    if (!state.selected) return;
    state.selected.panelOffset.y = Number(e.target.value);
  });

  document.getElementById("deleteBtn").onclick = () => {
    if (!state.selected) return;

    removeHotspot(state.selected);
    state.selected = null;
  };

  document.getElementById("importJsonBtn").onclick = () => {
    document.getElementById("jsonInput").click();
  };

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
