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
    hotspot: null,
    light: null,
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

Object.defineProperties(state, {
  selected: {
    get() {
      return this.selection.hotspot;
    },
    set(value) {
      this.selection.hotspot = value;
    },
  },
  selectedLight: {
    get() {
      return this.selection.light;
    },
    set(value) {
      this.selection.light = value;
    },
  },
});

export { state };
