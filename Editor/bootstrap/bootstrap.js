import * as THREE from "three";

import { clearSelection, state } from "../state/state.js";
import {
  createHotspot,
  deselectHotspot,
  removeHotspot,
  updateHotspots,
  updatePanelHTML
} from "../hotspots/hotspots.js";
import {
  bindLightUI,
  deselectLight,
  selectLight,
  updateLights
} from "../lights/lights.js";
import { bindIO } from "../io/io.js";
import { bindUI, showSidebarTab } from "../ui/ui.js";
import { resizeRenderer, startAnimation } from "../render/render.js";

const hotspotInspectorControlIds = [
  "titleInput",
  "descInput",
  "panelX",
  "panelY",
  "deleteBtn"
];

const lightInspectorControlIds = [
  "deleteLightBtn",
  "lightColor",
  "lightIntensity",
  "lightPosX",
  "lightPosY",
  "lightPosZ",
  "targetPosX",
  "targetPosY",
  "targetPosZ",
  "castShadow"
];

let inspectorSelectionListenerBound = false;

function getControl(id) {
  return document.getElementById(id);
}

function setControlsDisabled(ids, disabled) {
  ids.forEach((id) => {
    const control = getControl(id);
    if (control) {
      control.disabled = disabled;
    }
  });
}

function setControlValue(id, value) {
  const control = getControl(id);
  if (!control) return;

  if (control.type === "checkbox") {
    control.checked = Boolean(value);
    return;
  }

  control.value = value;
}

function setElementHidden(id, hidden) {
  const element = getControl(id);
  if (element) {
    element.hidden = hidden;
  }
}

function showInspectorPanel(type) {
  setElementHidden("nothingSelectedInspector", type !== null);
  setElementHidden("hotspotInspector", type !== "hotspot");
  setElementHidden("lightInspector", type !== "light");
}

function clearHotspotInspector() {
  setControlValue("titleInput", "");
  setControlValue("descInput", "");
  setControlValue("panelX", "");
  setControlValue("panelY", "");
  setControlsDisabled(hotspotInspectorControlIds, true);
}

function clearLightInspector() {
  setControlValue("lightColor", "#ffffff");
  setControlValue("lightIntensity", 2);
  setControlValue("lightPosX", "");
  setControlValue("lightPosY", "");
  setControlValue("lightPosZ", "");
  setControlValue("targetPosX", "");
  setControlValue("targetPosY", "");
  setControlValue("targetPosZ", "");
  setControlValue("castShadow", false);
  setControlsDisabled(lightInspectorControlIds, true);
}

function disableAllInspectorControls() {
  setControlsDisabled(hotspotInspectorControlIds, true);
  setControlsDisabled(lightInspectorControlIds, true);
}

function resetInspectorUI() {
  clearHotspotInspector();
  clearLightInspector();
  disableAllInspectorControls();
}

function refreshHotspotInspector(hotspot) {
  showSidebarTab("properties");
  showInspectorPanel("hotspot");
  clearLightInspector();
  setControlsDisabled(hotspotInspectorControlIds, false);

  setControlValue("titleInput", hotspot.title);
  setControlValue("descInput", hotspot.description);
  setControlValue("panelX", hotspot.panelOffset.x);
  setControlValue("panelY", hotspot.panelOffset.y);
}

function refreshLightInspector(lightData) {
  showSidebarTab("properties");
  showInspectorPanel("light");
  clearHotspotInspector();
  setControlsDisabled(lightInspectorControlIds, false);

  setControlValue("lightColor", lightData.color);
  setControlValue("lightIntensity", lightData.intensity);
  setControlValue("lightPosX", lightData.light.position.x.toFixed(2));
  setControlValue("lightPosY", lightData.light.position.y.toFixed(2));
  setControlValue("lightPosZ", lightData.light.position.z.toFixed(2));
  setControlValue("targetPosX", lightData.target.position.x.toFixed(2));
  setControlValue("targetPosY", lightData.target.position.y.toFixed(2));
  setControlValue("targetPosZ", lightData.target.position.z.toFixed(2));
  setControlValue("castShadow", lightData.castShadow);
}

function clearInspector() {
  resetInspectorUI();
  showInspectorPanel(null);
}

function refreshInspector(event = null) {
  const selection = event?.detail || state.selection;

  if (selection.type === "hotspot" && selection.object) {
    refreshHotspotInspector(selection.object);
    return;
  }

  if (selection.type === "light" && selection.object) {
    refreshLightInspector(selection.object);
    return;
  }

  clearInspector();
}

function emitSelectionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("editorselectionchange", { detail: state.selection }));
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

  if (!inspectorSelectionListenerBound) {
    window.addEventListener("editorselectionchange", refreshInspector);
    inspectorSelectionListenerBound = true;
  }

  refreshInspector();
  emitSelectionChanged();

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
      deselectLight();
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
    clearSelection("hotspot");
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
