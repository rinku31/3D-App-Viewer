import * as THREE from "three";
import { state, setSelection, clearSelection, notifySelectionChanged } from "../state/state.js";

/**
 * Universal selection controller for all scene entities:
 * - "hotspot": Hotspot annotation
 * - "light": Custom directional light instance
 * - "lightTarget": Directional light target Object3D
 * - "model": Root imported GLB model
 * - "mesh": Individual child Mesh/Group in model
 * - "camera": Scene perspective camera
 * - "scene": Scene root
 */

function select(type, object, target = null) {
  if (!object && type !== "scene") {
    deselect();
    return;
  }

  // Update visual markers
  updateVisualSelection(type, object);

  // Set unified state
  setSelection(type, object, target);
}

function deselect(type = null) {
  if (type && state.selection.type !== type) return;

  resetVisualHighlights();
  clearSelection();
}

function resetVisualHighlights() {
  // Clear hotspot DOM styles
  if (typeof document !== "undefined") {
    document.querySelectorAll(".hotspot").forEach((el) => {
      el.classList.remove("selected");
    });
  }

  // Reset custom light sprite colors
  if (Array.isArray(state.lights)) {
    state.lights.forEach((l) => {
      if (l.lightSprite?.material?.color) {
        l.lightSprite.material.color.set(0xffff00);
      }
      if (l.targetSprite?.material?.color) {
        l.targetSprite.material.color.set(0x00ffff);
      }
    });
  }
}

function updateVisualSelection(type, object) {
  resetVisualHighlights();

  if (type === "hotspot" && object?.dot) {
    object.dot.classList.add("selected");
  } else if (type === "light" && object?.lightSprite) {
    if (object.lightSprite.material?.color) {
      object.lightSprite.material.color.set(0x00ff00);
    }
  } else if (type === "lightTarget" && object?.targetSprite) {
    if (object.targetSprite.material?.color) {
      object.targetSprite.material.color.set(0xff0000);
    }
  }
}

function isSelected(type, object) {
  if (!state.selection.object || state.selection.type !== type) return false;
  return state.selection.object === object;
}

export {
  select,
  deselect,
  resetVisualHighlights,
  updateVisualSelection,
  isSelected
};
