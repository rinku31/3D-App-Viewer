const state = {
  viewport: null,
  overlay: null,
  hotspotLines: null,
  sidebar: null,
  toggleSidebarBtn: null,

  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: null,

  currentModel: null,
  hotspots: [],
  lights: [],

  selection: {
    type: null,
    object: null,
    target: null,
  },

  currentTool: "hotspot",
  currentMode: "idle",
  addMode: false,
  draggingHotspot: false,
  importedJsonFileName: "hotspots.json",

  sceneSettings: {
    background: "#3f3f3f",
    environment: {
      intensity: 1.0,
      exposure: 1.6,
      toneMapping: "ACESFilmic",
      hdri: "studio_small_09",
    },
  },
};

function setSelection(type, object, target = null) {
  state.selection.type = type;
  state.selection.object = object;
  state.selection.target = target;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("editorselectionchange", {
      detail: state.selection,
    }));
  }
}

function notifySelectionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("editorselectionchange", {
      detail: state.selection,
    }));
  }
}

function clearSelection(type = null) {
  if (type && state.selection.type !== type) return;

  state.selection.type = null;
  state.selection.object = null;
  state.selection.target = null;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("editorselectionchange", {
      detail: state.selection,
    }));
  }
}

Object.defineProperties(state, {
  selected: {
    get() {
      return this.selection.type === "hotspot"
        ? this.selection.object
        : null;
    },
    set(value) {
      if (value) {
        setSelection("hotspot", value);
        return;
      }

      clearSelection("hotspot");
    },
  },
  selectedLight: {
    get() {
      return this.selection.type === "light"
        ? this.selection.object
        : null;
    },
    set(value) {
      if (value) {
        setSelection("light", value);
        return;
      }

      clearSelection("light");
    },
  },
});

export {
  clearSelection,
  notifySelectionChanged,
  setSelection,
  state
};
