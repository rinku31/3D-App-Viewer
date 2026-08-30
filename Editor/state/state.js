const state = {
  viewport: null,
  overlay: null,
  hotspotLines: null,
  sidebar: null,
  toggleSidebarBtn: null,

  scene: null,
  camera: null,
  cameraRig: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: null,
  currentFileHandle: null,
  currentFilePath: null,

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

  gizmo: {
    mode: "translate", // "translate" | "rotate" | "scale"
    space: "world",    // "world" | "local"
    snap: false,
    visible: true,
  },

  defaultAmbientLight: null,
  defaultDirectionalLight: null,
  transformControls: null,

  gridHelper: null,
  axesHelper: null,

  bloomManager: null,

  editorBackground: {
    color: "#222228",
    type: "color", // "color" | "environment" | "transparent"
    blur: 0.0,
  },

  sceneSettings: {
    environment: {
      preset: "studio_small_09",
      customHdrUrl: null,
      intensity: 1.0,
      rotation: 0.0,
      exposure: 1.0,
      exposureEV: 0.0,
      toneMapping: "AgX",
      look: "None", // "None" | "Medium Contrast" | "High Contrast" | "Very High Contrast"
    },
    rendering: {
      shadows: true,
      shadowType: "pcfsoft",
      contactShadows: true,
      shadowSoftness: 2.0,
      blenderCyclesMode: true,
    },
    bloom: {
      enabled: false,
      strength: 0.6,
      radius: 0.4,
      threshold: 0.85,
    },
    helpers: {
      grid: true,
      axes: false,
    },
    line: {
      color: "#44D62C",
      style: "dashed",
      width: 1.5,
      offset: { x: 0, y: 0 }
    },
    hotspots: {
      panelColor: "rgba(30, 30, 36, 0.95)",
      pulseAnimation: true,
      theme: "default",
      occlusionTolerance: 0.08
    },
    controls: {
      defaultEnabled: true,
      explodeEnabled: true,
      simulatorEnabled: true,
      simulatorJsFunction: "onSimulatorToggle",
      simulatorUrl: ""
    }
  },

  cameraSettings: {
    fov: 45,
    near: 0.01,
    far: 1000,
    minDistance: 1.35,
    maxDistance: 16.0,
    viewpoints: [],
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
