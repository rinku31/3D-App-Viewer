import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { state, notifySelectionChanged } from "../state/state.js";
import { updateLights } from "../lights/lights.js";
import { pushHistoryState } from "../state/history.js";

let transformControls = null;
let gizmoAnchor = null;
let activeTransformTarget = null;
let isTransforming = false;

function initializeGizmo() {
  if (transformControls) return transformControls;

  const scene = state.scene;
  const camera = state.camera;
  const renderer = state.renderer;

  if (!scene || !camera || !renderer) return null;

  state.gizmo = state.gizmo || { mode: "translate", space: "world", visible: true };

  // Invisible anchor object used for manipulating entities that aren't single Object3D instances (e.g., hotspots)
  gizmoAnchor = new THREE.Object3D();
  gizmoAnchor.name = "__gizmo_anchor__";
  scene.add(gizmoAnchor);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.size = 0.85;
  transformControls.setMode("translate");
  transformControls.setSpace("world");

  // Prevent OrbitControls from interfering during gizmo drag
  transformControls.addEventListener("dragging-changed", (event) => {
    isTransforming = Boolean(event.value);
    if (state.controls) {
      state.controls.enabled = !isTransforming;
    }
    if (!isTransforming) {
      pushHistoryState(); // Push state when gizmo drag completes
    }
  });

  // Handle object change during gizmo manipulation
  transformControls.addEventListener("change", onGizmoChange);
  transformControls.addEventListener("objectChange", onGizmoObjectChange);

  scene.add(transformControls);
  state.transformControls = transformControls;

  // Listen for selection changes to attach/detach gizmo
  window.addEventListener("editorselectionchange", onSelectionChange);

  // Setup keyboard shortcuts
  setupGizmoShortcuts();

  // Attach toolbar controls
  bindGizmoToolbar();

  return transformControls;
}

function onSelectionChange(event) {
  const selection = event?.detail || state.selection;
  if (!selection || !selection.type || !selection.object) {
    detachGizmo();
    return;
  }

  attachGizmoForSelection(selection);
}

function attachGizmoForSelection(selection) {
  if (!transformControls || !state.scene) return;

  const { type, object } = selection;

  if (type === "hotspot" && object) {
    activeTransformTarget = { type: "hotspot", object };
    const pos = object.position;
    gizmoAnchor.position.set(pos[0], pos[1], pos[2]);
    gizmoAnchor.rotation.set(0, 0, 0);
    gizmoAnchor.scale.set(1, 1, 1);
    transformControls.attach(gizmoAnchor);
    transformControls.setMode("translate");
  } else if (type === "light" && object?.light) {
    activeTransformTarget = { type: "light", object };
    transformControls.attach(object.light);
    transformControls.setMode("translate");
  } else if (type === "lightTarget" && object?.target) {
    activeTransformTarget = { type: "lightTarget", object };
    transformControls.attach(object.target);
    transformControls.setMode("translate");
  } else {
    detachGizmo();
    return;
  }

  // Respect gizmo visibility toggle (Three.js attach() internally forces visible = true)
  const isVisible = state.gizmo?.visible !== false;
  transformControls.enabled = isVisible;
  transformControls.visible = isVisible;

  updateGizmoToolbarUI();
}

function detachGizmo() {
  if (transformControls) {
    transformControls.detach();
  }
  activeTransformTarget = null;
}

function onGizmoChange() {
  // Sync state during transform
  if (!activeTransformTarget) return;

  const { type, object } = activeTransformTarget;

  if (type === "hotspot" && object && gizmoAnchor) {
    object.position = [
      gizmoAnchor.position.x,
      gizmoAnchor.position.y,
      gizmoAnchor.position.z,
    ];
  } else if (type === "light" && object) {
    if (object.lightSprite && object.light) {
      object.lightSprite.position.copy(object.light.position);
    }
    updateLights();
  } else if (type === "lightTarget" && object) {
    if (object.targetSprite && object.target) {
      object.targetSprite.position.copy(object.target.position);
    }
    updateLights();
  }

  // Dispatches update for live inspector fields
  notifySelectionChanged();
}

function onGizmoObjectChange() {
  onGizmoChange();
}

function updateGizmoAnchorPosition(x, y, z) {
  if (gizmoAnchor) {
    gizmoAnchor.position.set(x, y, z);
  }
}

function setGizmoMode(mode) {
  if (!transformControls) return;
  state.gizmo = state.gizmo || {};
  state.gizmo.mode = "translate";
  transformControls.setMode("translate");
  updateGizmoToolbarUI();
}

function toggleGizmoVisibility() {
  if (!transformControls) return;

  state.gizmo = state.gizmo || {};
  const currentlyVisible = state.gizmo.visible !== false;
  const newVisible = !currentlyVisible;
  state.gizmo.visible = newVisible;

  transformControls.enabled = newVisible;
  transformControls.visible = newVisible;

  updateGizmoToolbarUI();
}

function setupGizmoShortcuts() {
  window.addEventListener("keydown", (e) => {
    // Ignore key shortcuts if focus is in an input or textarea
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
      return;
    }

    const key = e.key.toLowerCase();

    if (key === "g" || key === "w") {
      setGizmoMode("translate");
    } else if (key === "x") {
      toggleGizmoVisibility();
    } else if (key === "escape") {
      if (state.addMode) {
        document.getElementById("addBtn")?.click();
      }
    }
  });
}

function bindGizmoToolbar() {
  const hideBtn = document.getElementById("gizmoHideBtn");
  if (hideBtn) hideBtn.onclick = () => toggleGizmoVisibility();
  updateGizmoToolbarUI();
}

function updateGizmoToolbarUI() {
  const visible = state.gizmo?.visible !== false;
  const hideBtn = document.getElementById("gizmoHideBtn");

  if (hideBtn) {
    hideBtn.classList.toggle("active", visible);
    hideBtn.title = visible ? "Gizmo is Visible (Press X to hide)" : "Gizmo is Hidden (Press X to show)";
  }
}

export {
  initializeGizmo,
  attachGizmoForSelection,
  detachGizmo,
  setGizmoMode,
  toggleGizmoVisibility,
  updateGizmoAnchorPosition,
  updateGizmoToolbarUI
};
