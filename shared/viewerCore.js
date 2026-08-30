/**
 * Shared Viewer Core Engine
 * Unified 3D presentation engine powering both standalone Viewer and Embed iframe views.
 * Ensures 100% parity for rendering, occlusion calculations, HUD interactivity, and URL parsing.
 */

import * as THREE from "three";
import { CameraRig } from "./CameraRig.js";
import { createEnvironmentManager } from "./environment.js";
import { createBloomManager } from "./bloom.js";
import { testHotspotOcclusion } from "./hotspotMath.js";
import { buildHotspotOverlays, updateOverlayPositions, clearHotspotOverlays } from "./hotspotOverlay.js";
import {
  loadViewerModel,
  loadViewerSceneJson,
  applyViewerSceneSettings,
  syncViewerLights,
  showViewerLoading,
  hideViewerLoading
} from "./viewerLoader.js";
import {
  initializeViewerHUD,
  resetViewerCamera,
  toggleAutoRotate,
  setTurntableSpeed,
  setEnvironmentPreset,
  updateHudSceneInfo
} from "./viewerHUD.js";
import { sanitizeAssetUrl } from "./schema.js";
import { disposeHierarchy } from "./disposal.js";

/**
 * Creates and initializes a complete 3D Viewer instance.
 * @param {object} [options] - Configuration options
 * @param {HTMLElement} [options.viewportEl] - Viewport container element
 * @param {boolean} [options.isEmbed=false] - Whether running inside an iframe
 * @param {boolean} [options.enableDrop=true] - Whether to enable drag-and-drop file ingestion
 * @returns {Promise<object>} Initialized viewer instance and API
 */
export async function createViewerCore(options = {}) {
  const isEmbed = Boolean(options.isEmbed);
  const viewport = options.viewportEl || document.getElementById("viewport") || document.body;

  // 1. Initialize State Object
  const viewerState = {
    // Three.js Instances
    scene: new THREE.Scene(),
    camera: null,
    cameraRig: null,
    renderer: null,
    raycaster: new THREE.Raycaster(),
    viewport,

    // Managers & Post-Processing
    environmentManager: null,
    bloomManager: null,
    bloom: {
      enabled: false,
      strength: 0.6,
      radius: 0.4,
      threshold: 0.85
    },

    // Lights
    defaultAmbientLight: null,
    defaultDirectionalLight: null,
    customLights: [],

    // Assets & Scene Document
    currentModel: null,
    sceneDocument: null,
    hotspots: [],

    // DOM References
    container: document.body,
    overlay: document.getElementById("overlay"),
    svg: document.getElementById("svg"),
    modelInput: document.getElementById("modelInput"),

    // Visibility & Performance
    visibilityDirty: true,
    lastVisibilityUpdate: 0,
    visibilityInterval: 100,
    qualityScale: 1.0,

    // Methods
    updateHudInfo: (title) => updateHudSceneInfo(viewerState, title),
    isEmbed
  };

  // 2. Initialize Three.js Renderer & Camera
  const width = viewport.clientWidth || window.innerWidth;
  const height = viewport.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    logarithmicDepthBuffer: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);
  viewerState.renderer = renderer;

  // 3. Initialize Camera Rig
  const cameraRig = new CameraRig(renderer.domElement, {
    fov: 45,
    near: 0.1,
    far: 2000,
    initialRadius: 5,
    damping: 0.08,
    antiClipping: true,
    minDistance: 0.2,
    maxDistance: 200
  });
  viewerState.cameraRig = cameraRig;
  viewerState.camera = cameraRig.camera;

  // 4. Initialize Environment & Bloom Managers
  viewerState.environmentManager = createEnvironmentManager(viewerState.scene, renderer);
  viewerState.bloomManager = createBloomManager(renderer, viewerState.scene, viewerState.camera);

  // 5. Initialize Default Lighting
  initializeCoreLights(viewerState);

  // 6. Handle Resize
  const handleResize = () => {
    const w = viewport.clientWidth || window.innerWidth;
    const h = viewport.clientHeight || window.innerHeight;
    cameraRig.setSize(w, h);
    renderer.setSize(w, h);
    if (viewerState.bloomManager) {
      viewerState.bloomManager.setSize(w, h);
    }
    updateOverlayPositions(viewerState);
  };

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(viewport);
  window.addEventListener("resize", handleResize);

  // 7. Initialize HUD and Controls
  initializeViewerHUD(viewerState, { isEmbed });

  // 8. Bind postMessage API & drag/drop
  setupPostMessageAPI(viewerState);
  if (options.enableDrop !== false) {
    setupDragAndDrop(viewerState);
  }
  if (viewerState.modelInput) {
    setupFileInput(viewerState);
  }

  // 9. Start Main Render / Animation Loop
  let isRunning = true;
  const clock = new THREE.Clock();

  function renderLoop() {
    if (!isRunning) return;
    requestAnimationFrame(renderLoop);

    const delta = clock.getDelta();
    cameraRig.update(delta);

    // Occlusion testing
    updateViewerOcclusion(viewerState);

    // Project 2D overlays & leader lines
    updateOverlayPositions(viewerState);

    // Render Scene or Post-Processing pass
    if (viewerState.bloomManager && viewerState.bloom.enabled) {
      viewerState.bloomManager.render();
    } else {
      renderer.render(viewerState.scene, viewerState.camera);
    }
  }
  requestAnimationFrame(renderLoop);

  // 10. Parse URL Query Parameters & Ingest initial assets
  await ingestURLParameters(viewerState);

  // Return Viewer Public API
  return {
    state: viewerState,
    loadModel: (src, name, json, files) => loadViewerModel(viewerState, src, name, json, files),
    loadScene: (json, name) => loadViewerSceneJson(viewerState, json, name),
    resetCamera: () => resetViewerCamera(viewerState),
    toggleTurntable: (val) => toggleAutoRotate(viewerState, val),
    setSpeed: (spd) => setTurntableSpeed(viewerState, spd),
    setEnvironment: (preset) => setEnvironmentPreset(viewerState, preset),
    dispose: () => {
      isRunning = false;
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (viewerState.currentModel) {
        viewerState.scene.remove(viewerState.currentModel);
        disposeHierarchy(viewerState.currentModel);
      }
      clearHotspotOverlays(viewerState);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

/**
 * Initializes default ambient & directional lighting.
 */
function initializeCoreLights(viewerState) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  viewerState.scene.add(ambient);
  viewerState.defaultAmbientLight = ambient;

  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 30;
  dir.shadow.bias = -0.0001;
  dir.shadow.normalBias = 0.02;
  dir.shadow.radius = 2.0;
  viewerState.scene.add(dir);
  viewerState.defaultDirectionalLight = dir;
}

/**
 * Throttled occlusion testing for hotspots.
 */
function updateViewerOcclusion(viewerState, force = false) {
  if (!viewerState.sceneDocument || !viewerState.camera || !viewerState.currentModel || !viewerState.hotspots?.length) {
    return;
  }

  const now = performance.now();
  if (!force && now - viewerState.lastVisibilityUpdate < viewerState.visibilityInterval) {
    return;
  }

  viewerState.lastVisibilityUpdate = now;
  viewerState.visibilityDirty = false;

  const tolerance = viewerState.sceneDocument.settings?.hotspots?.occlusionTolerance ?? 0.08;

  viewerState.hotspots.forEach((h) => {
    if (!h.position) return;
    const isVisible = testHotspotOcclusion(
      h.position,
      viewerState.camera,
      viewerState.currentModel,
      viewerState.raycaster,
      tolerance
    );
    h.visible = isVisible;
  });
}

/**
 * Parses and ingests URL parameters for models, scenes, environment, and turntable settings.
 */
async function ingestURLParameters(viewerState) {
  const params = new URLSearchParams(window.location.search);
  const glbRaw = params.get("glb") || params.get("model") || params.get("gltf");
  const jsonRaw = params.get("json") || params.get("scene");
  const glbParam = glbRaw ? sanitizeAssetUrl(glbRaw) : null;
  const jsonParam = jsonRaw ? sanitizeAssetUrl(jsonRaw) : null;
  const titleParam = params.get("title");
  const envParam = params.get("env") || params.get("preset") || "studio_small_09";
  const turntableParam = params.get("turntable") || params.get("autorotate");
  const speedParam = params.get("speed");
  const bgParam = params.get("bg") || params.get("background") || "#222228";

  // Apply environment background & load environment
  if (bgParam) {
    viewerState.environmentManager.applyBackground({ background: bgParam, backgroundType: "color" });
  }
  viewerState.environmentManager.loadEnvironment(envParam);
  viewerState.environmentManager.preloadPresets();

  let companionJsonObject = null;

  if (jsonParam) {
    showViewerLoading(viewerState, "Fetching Scene Data...");
    try {
      const candidates = [
        jsonParam,
        decodeURI(jsonParam),
        `.${jsonParam.startsWith("/") ? "" : "/"}${jsonParam}`,
        `../${jsonParam.replace(/^\/+/, "")}`
      ];

      for (const p of candidates) {
        try {
          const attempt = await fetch(p, { mode: "cors" });
          if (attempt.ok) {
            companionJsonObject = await attempt.json();
            break;
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn("Failed to fetch scene JSON:", err);
    } finally {
      hideViewerLoading(viewerState);
    }
  }

  // Load Model
  if (glbParam) {
    try {
      const cleanName = decodeURIComponent(glbParam.split("/").pop().replace(/\.[^/.]+$/, ""));
      const modelName = titleParam || companionJsonObject?.metadata?.title || cleanName || "Product";
      await loadViewerModel(viewerState, glbParam, modelName, companionJsonObject);
      if (titleParam) updateHudSceneInfo(viewerState, titleParam);
      applyTurntableParams(viewerState, turntableParam, speedParam);
      return;
    } catch (err) {
      console.warn(`Failed to load GLB model from '${glbParam}':`, err);
    }
  }

  // Load Companion JSON
  if (companionJsonObject) {
    const modelName = titleParam || companionJsonObject.metadata?.title || "Product";
    loadViewerSceneJson(viewerState, companionJsonObject, modelName);
    if (titleParam) updateHudSceneInfo(viewerState, titleParam);
    applyTurntableParams(viewerState, turntableParam, speedParam);
    return;
  }

  // Default Demo Asset Ingestion (relative paths for GitHub Pages / subpaths)
  const defaultCandidates = [
    "./assets/Products/Viper V4 Pro.json",
    "../Viewer/assets/Products/Viper V4 Pro.json",
    "/Viewer/assets/Products/Viper V4 Pro.json"
  ];

  for (const path of defaultCandidates) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          loadViewerSceneJson(viewerState, data, titleParam || "Viper V4 Pro");
          applyTurntableParams(viewerState, turntableParam, speedParam);
          return;
        }
      }
    } catch (_) {}
  }

  // Procedural Empty Fallback
  loadViewerSceneJson(viewerState, {}, titleParam || "Product Showcase");
  applyTurntableParams(viewerState, turntableParam, speedParam);
}

function applyTurntableParams(viewerState, turntableParam, speedParam) {
  if (speedParam) setTurntableSpeed(viewerState, speedParam);
  if (turntableParam === "true" || turntableParam === "1") {
    toggleAutoRotate(viewerState, true);
  }
}

/**
 * Handles incoming postMessage commands from parent host window.
 */
function setupPostMessageAPI(viewerState) {
  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    switch (data.type) {
      case "RESET_CAMERA":
      case "RESET_VIEW":
        resetViewerCamera(viewerState);
        break;

      case "SET_TURNTABLE":
      case "TOGGLE_TURNTABLE":
        if (typeof data.enabled === "boolean") {
          toggleAutoRotate(viewerState, data.enabled);
        } else {
          toggleAutoRotate(viewerState);
        }
        if (data.speed) setTurntableSpeed(viewerState, data.speed);
        break;

      case "SET_SPEED":
        if (data.speed) setTurntableSpeed(viewerState, data.speed);
        break;

      case "SET_ENVIRONMENT":
      case "SET_PRESET":
        if (data.preset) setEnvironmentPreset(viewerState, data.preset);
        break;

      case "SET_TITLE":
        if (data.title) updateHudSceneInfo(viewerState, data.title);
        break;

      case "LOAD_MODEL":
        if (data.url) {
          try {
            await loadViewerModel(viewerState, data.url, data.name || "Product", data.companionJson);
          } catch (err) {
            console.error("postMessage LOAD_MODEL error:", err);
          }
        }
        break;

      case "LOAD_SCENE":
        if (data.json) {
          loadViewerSceneJson(viewerState, data.json, data.title || "Product");
        } else if (data.url) {
          try {
            const res = await fetch(data.url);
            if (res.ok) {
              const json = await res.json();
              loadViewerSceneJson(viewerState, json, data.title || "Product");
            }
          } catch (err) {
            console.error("postMessage LOAD_SCENE URL error:", err);
          }
        }
        break;

      case "FLY_TO_HOTSPOT":
        if (typeof data.index === "number" && viewerState.hotspots[data.index]?.position) {
          viewerState.cameraRig?.flyToHotspot(viewerState.hotspots[data.index].position);
        }
        break;
    }
  });
}

/**
 * Enables drag-and-drop file ingestion onto the viewer viewport.
 */
function setupDragAndDrop(viewerState) {
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;

    const glbFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
    const jsonFile = files.find((f) => /\.json$/i.test(f.name));

    if (glbFile) {
      const modelBaseName = glbFile.name.replace(/\.[^/.]+$/, "");
      await loadViewerModel(viewerState, glbFile, modelBaseName, jsonFile, files);
    } else if (jsonFile) {
      try {
        const text = await jsonFile.text();
        const modelName = viewerState.currentModel?.name || jsonFile.name.replace(/\.json$/i, "");
        loadViewerSceneJson(viewerState, text, modelName);
      } catch (err) {
        console.error("Failed to parse dropped JSON scene file:", err);
      }
    }
  });
}

/**
 * Connects HTML file input button to model/scene loader.
 */
function setupFileInput(viewerState) {
  viewerState.modelInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const glbFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
    const jsonFile = files.find((f) => /\.json$/i.test(f.name));

    if (glbFile) {
      const modelBaseName = glbFile.name.replace(/\.[^/.]+$/, "");
      await loadViewerModel(viewerState, glbFile, modelBaseName, jsonFile, files);
    } else if (jsonFile) {
      try {
        const text = await jsonFile.text();
        const modelName = viewerState.currentModel?.name || jsonFile.name.replace(/\.json$/i, "");
        loadViewerSceneJson(viewerState, text, modelName);
      } catch (err) {
        console.error("Failed to load scene JSON file:", err);
      }
    }

    viewerState.modelInput.value = "";
  });
}
