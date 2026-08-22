import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { state, notifySelectionChanged } from "../state/state.js";
import { updateLights } from "../lights/lights.js";

let transformControls = null;
let gizmoAnchor = null;
let activeTransformTarget = null;
let isTransforming = false;

const snapConfig = {
  translation: 0.25,
  rotation: THREE.MathUtils.degToRad(15),
  scale: 0.1,
};

function initializeGizmo() {
  if (transformControls) return transformControls;

  const scene = state.scene;
  const camera = state.camera;
  const renderer = state.renderer;

  if (!scene || !camera || !renderer) return null;

  // Invisible anchor object used for manipulating entities that aren't single Object3D instances (e.g., hotspots)
  gizmoAnchor = new THREE.Object3D();
  gizmoAnchor.name = "__gizmo_anchor__";
  scene.add(gizmoAnchor);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.size = 0.85;
  transformControls.setMode(state.gizmo?.mode || "translate");
  transformControls.setSpace(state.gizmo?.space || "world");

  // Prevent OrbitControls from interfering during gizmo drag
  transformControls.addEventListener("dragging-changed", (event) => {
    isTransforming = Boolean(event.value);
    if (state.controls) {
      state.controls.enabled = !isTransforming;
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

  const { type, object, target } = selection;

  if (type === "hotspot" && object) {
    activeTransformTarget = { type: "hotspot", object };
    const pos = object.position;
    gizmoAnchor.position.set(pos[0], pos[1], pos[2]);
    gizmoAnchor.rotation.set(0, 0, 0);
    gizmoAnchor.scale.set(1, 1, 1);
    transformControls.attach(gizmoAnchor);
    transformControls.setMode("translate"); // Hotspots only translate
  } else if (type === "light" && object?.light) {
    activeTransformTarget = { type: "light", object };
    transformControls.attach(object.light);
    transformControls.setMode(state.gizmo?.mode || "translate");
  } else if (type === "lightTarget" && object?.target) {
    activeTransformTarget = { type: "lightTarget", object };
    transformControls.attach(object.target);
    transformControls.setMode("translate");
  } else if (type === "model" && object) {
    activeTransformTarget = { type: "model", object };
    transformControls.attach(object);
    transformControls.setMode(state.gizmo?.mode || "translate");
  } else if (type === "mesh" && object) {
    activeTransformTarget = { type: "mesh", object };
    transformControls.attach(object);
    transformControls.setMode(state.gizmo?.mode || "translate");
  } else {
    detachGizmo();
  }

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
  if (mode !== "translate" && mode !== "rotate" && mode !== "scale") return;

  // Hotspots and Light targets only support translation
  if (
    (state.selection?.type === "hotspot" || state.selection?.type === "lightTarget") &&
    mode !== "translate"
  ) {
    return;
  }

  state.gizmo = state.gizmo || {};
  state.gizmo.mode = mode;
  transformControls.setMode(mode);
  updateGizmoToolbarUI();
}

function setGizmoSpace(space) {
  if (!transformControls) return;
  if (space !== "world" && space !== "local") return;

  state.gizmo = state.gizmo || {};
  state.gizmo.space = space;
  transformControls.setSpace(space);
  updateGizmoToolbarUI();
}

function toggleGizmoSnap() {
  if (!transformControls) return;

  state.gizmo = state.gizmo || {};
  const isSnap = !state.gizmo.snap;
  state.gizmo.snap = isSnap;

  transformControls.setTranslationSnap(isSnap ? snapConfig.translation : null);
  transformControls.setRotationSnap(isSnap ? snapConfig.rotation : null);
  transformControls.setScaleSnap(isSnap ? snapConfig.scale : null);

  updateGizmoToolbarUI();
}

function toggleGizmoVisibility() {
  if (!transformControls) return;

  state.gizmo = state.gizmo || {};
  const visible = state.gizmo.visible === false ? true : false;
  state.gizmo.visible = visible;
  transformControls.enabled = visible;
  transformControls.visible = visible;

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
    } else if (key === "r" || key === "e") {
      setGizmoMode("rotate");
    } else if (key === "s") {
      setGizmoMode("scale");
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
  const translateBtn = document.getElementById("gizmoTranslateBtn");
  const rotateBtn = document.getElementById("gizmoRotateBtn");
  const scaleBtn = document.getElementById("gizmoScaleBtn");
  const spaceBtn = document.getElementById("gizmoSpaceBtn");
  const snapBtn = document.getElementById("gizmoSnapBtn");
  const hideBtn = document.getElementById("gizmoHideBtn");

  if (translateBtn) translateBtn.onclick = () => setGizmoMode("translate");
  if (rotateBtn) rotateBtn.onclick = () => setGizmoMode("rotate");
  if (scaleBtn) scaleBtn.onclick = () => setGizmoMode("scale");
  if (spaceBtn) spaceBtn.onclick = () => setGizmoSpace(state.gizmo?.space === "world" ? "local" : "world");
  if (snapBtn) snapBtn.onclick = () => toggleGizmoSnap();
  if (hideBtn) hideBtn.onclick = () => toggleGizmoVisibility();

  updateGizmoToolbarUI();
}

function updateGizmoToolbarUI() {
  const mode = state.gizmo?.mode || "translate";
  const space = state.gizmo?.space || "world";
  const snap = Boolean(state.gizmo?.snap);
  const visible = state.gizmo?.visible !== false;

  const translateBtn = document.getElementById("gizmoTranslateBtn");
  const rotateBtn = document.getElementById("gizmoRotateBtn");
  const scaleBtn = document.getElementById("gizmoScaleBtn");
  const spaceBtn = document.getElementById("gizmoSpaceBtn");
  const snapBtn = document.getElementById("gizmoSnapBtn");
  const hideBtn = document.getElementById("gizmoHideBtn");

  if (translateBtn) translateBtn.classList.toggle("active", mode === "translate");
  if (rotateBtn) rotateBtn.classList.toggle("active", mode === "rotate");
  if (scaleBtn) scaleBtn.classList.toggle("active", mode === "scale");

  if (spaceBtn) {
    spaceBtn.textContent = space.toUpperCase();
    spaceBtn.classList.toggle("active", space === "local");
  }

  if (snapBtn) {
    snapBtn.classList.toggle("active", snap);
    snapBtn.title = snap ? "Snapping Enabled (0.25m / 15°)" : "Toggle Snap";
  }

  if (hideBtn) {
    hideBtn.classList.toggle("active", !visible);
  }
}

export {
  initializeGizmo,
  attachGizmoForSelection,
  detachGizmo,
  setGizmoMode,
  setGizmoSpace,
  toggleGizmoSnap,
  toggleGizmoVisibility,
  updateGizmoAnchorPosition,
  updateGizmoToolbarUI
};
