/**
 * Embed Viewer Bootstrap Module
 * Handles subsystem initialization, query parameter ingestion (?glb=, ?json=, ?env=, ?turntable=, etc.),
 * drag-and-drop fallback, and postMessage communication for iframe embedding.
 */

import { state } from "../state/state.js";
import { initializeRender, startViewerLoop } from "../render/render.js";
import { initializeViewerLights } from "../lights/lights.js";
import { loadViewerModel, loadViewerSceneJson } from "../loading/loader.js";
import { updateHotspotVisibility } from "../visibility/visibility.js";
import { updateOverlayPositions } from "../overlay/overlay.js";
import {
  initializeViewerHUD,
  resetViewerCamera,
  toggleAutoRotate,
  setTurntableSpeed,
  setEnvironmentPreset,
  updateHudSceneInfo,
  showLoading,
  hideLoading
} from "../ui/hud.js";

/**
 * Bootstraps the embedded 3D viewer
 */
export async function bootstrapEmbedViewer() {
  // 1. Grab DOM references
  state.container = document.body;
  state.overlay = document.getElementById("overlay");
  state.svg = document.getElementById("svg");

  // 2. Initialize Three.js Rendering, CameraRig & Lighting
  initializeRender();
  initializeViewerLights();

  // 3. Initialize Commercial Floating HUD & Environment Selector
  initializeViewerHUD();

  // 4. Bind iframe postMessage API & drag-drop fallback
  setupPostMessageAPI();
  setupDragAndDrop();

  // 5. Start Animation / Render Loop
  startViewerLoop(() => {
    updateHotspotVisibility();
    updateOverlayPositions();
  });

  // 6. Parse URL Query Parameters
  const params = new URLSearchParams(window.location.search);
  const glbParam = params.get("glb") || params.get("model") || params.get("gltf");
  const jsonParam = params.get("json") || params.get("scene");
  const titleParam = params.get("title");
  const envParam = params.get("env") || params.get("preset") || "studio_small_09";
  const turntableParam = params.get("turntable") || params.get("autorotate");
  const speedParam = params.get("speed");
  const bgParam = params.get("bg") || params.get("background") || "#222228";

  // 7. Load Environment & Warm Preset Cache
  state.environmentManager.loadEnvironment(envParam, async () => {
    if (bgParam) {
      state.environmentManager.applyBackground({ background: bgParam, backgroundType: "color" });
    }
    state.environmentManager.preloadPresets();

    // 8. Ingest Assets according to query params
    await ingestQueryParams({ glbParam, jsonParam, titleParam });

    // 9. Apply turntable and speed query params
    if (turntableParam === "true" || turntableParam === "1") {
      if (speedParam) setTurntableSpeed(speedParam);
      toggleAutoRotate(true);
    } else if (speedParam) {
      setTurntableSpeed(speedParam);
    }

    if (titleParam) {
      updateHudSceneInfo(titleParam);
    }

    // 10. Emit ready message to host iframe container
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "3D_VIEWER_READY", payload: { title: titleParam || state.currentModel?.name } }, "*");
      }
    } catch (_) {}
  });
}

/**
 * Loads GLB model and/or JSON scene configuration based on query parameters.
 */
async function ingestQueryParams({ glbParam, jsonParam, titleParam }) {
  let companionJsonObject = null;

  // If a JSON scene parameter is provided, fetch it
  if (jsonParam) {
    showLoading("Fetching Scene Data...");
    try {
      const candidates = [
        jsonParam,
        `.${jsonParam.startsWith('/') ? '' : '/'}${jsonParam}`,
        `../${jsonParam.replace(/^\/+/, '')}`
      ];

      let res = null;
      for (const p of candidates) {
        try {
          const attempt = await fetch(p);
          if (attempt.ok) {
            const contentType = attempt.headers.get("content-type");
            if (!contentType || contentType.includes("json") || contentType.includes("text")) {
              res = attempt;
              break;
            }
          }
        } catch (_) {}
      }

      if (res && res.ok) {
        companionJsonObject = await res.json();
      } else {
        console.warn(`Could not fetch scene JSON from: ${jsonParam}`);
      }
    } catch (err) {
      console.warn("Failed to fetch scene JSON parameter:", err);
    } finally {
      hideLoading();
    }
  }

  // Case 1: GLB URL provided
  if (glbParam) {
    try {
      const modelName = titleParam || (companionJsonObject?.metadata?.title) || glbParam.split("/").pop().replace(/\.[^/.]+$/, "") || "Product";
      await loadViewerModel(glbParam, modelName, companionJsonObject);
      if (titleParam) updateHudSceneInfo(titleParam);
      return;
    } catch (err) {
      console.warn(`Failed to load GLB model from '${glbParam}' (will check companion JSON):`, err);
    }
  }

  // Case 2: JSON URL provided (or fallback if GLB 404'd)
  if (companionJsonObject) {
    const modelName = titleParam || companionJsonObject.metadata?.title || "Product";
    loadViewerSceneJson(companionJsonObject, modelName);
    if (titleParam) updateHudSceneInfo(titleParam);
    return;
  }

  // Case 3: No parameters provided -> Try loading demo scene
  const defaultCandidates = [
    "/Viewer/assets/Products/Viper V4 Pro.json",
    "../Viewer/assets/Products/Viper V4 Pro.json",
    "./assets/Products/Viper V4 Pro.json",
    "/assets/Products/Viper V4 Pro.json"
  ];

  for (const path of defaultCandidates) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          loadViewerSceneJson(data, titleParam || "Viper V4 Pro");
          return;
        }
      }
    } catch (_) {}
  }

  // Case 4: Procedural fallback
  loadViewerSceneJson({}, titleParam || "Product Showcase");
}

/**
 * Enables postMessage communication for parent webpage iframe control.
 */
function setupPostMessageAPI() {
  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    switch (data.type) {
      case "RESET_CAMERA":
      case "RESET_VIEW":
        resetViewerCamera();
        break;

      case "SET_TURNTABLE":
      case "TOGGLE_TURNTABLE":
        if (typeof data.enabled === "boolean") {
          toggleAutoRotate(data.enabled);
        } else {
          toggleAutoRotate();
        }
        if (data.speed) setTurntableSpeed(data.speed);
        break;

      case "SET_SPEED":
        if (data.speed) setTurntableSpeed(data.speed);
        break;

      case "SET_ENVIRONMENT":
      case "SET_PRESET":
        if (data.preset) setEnvironmentPreset(data.preset);
        break;

      case "SET_TITLE":
        if (data.title) updateHudSceneInfo(data.title);
        break;

      case "LOAD_MODEL":
        if (data.url) {
          try {
            await loadViewerModel(data.url, data.name || "Product", data.companionJson);
          } catch (err) {
            console.error("postMessage LOAD_MODEL error:", err);
          }
        }
        break;

      case "LOAD_SCENE":
        if (data.json) {
          loadViewerSceneJson(data.json, data.title || "Product");
        } else if (data.url) {
          try {
            const res = await fetch(data.url);
            if (res.ok) {
              const json = await res.json();
              loadViewerSceneJson(json, data.title || "Product");
            }
          } catch (err) {
            console.error("postMessage LOAD_SCENE URL error:", err);
          }
        }
        break;

      case "FLY_TO_HOTSPOT":
        if (typeof data.index === "number" && state.hotspots[data.index]?.position) {
          state.cameraRig?.flyToHotspot(state.hotspots[data.index].position);
        }
        break;

      default:
        break;
    }
  });
}

/**
 * Allows drag-and-dropping .glb or .json files directly into the iframe for quick previewing.
 */
function setupDragAndDrop() {
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
      await loadViewerModel(glbFile, modelBaseName, jsonFile);
    } else if (jsonFile) {
      try {
        const text = await jsonFile.text();
        const modelName = state.currentModel?.name || jsonFile.name.replace(/\.json$/i, "");
        loadViewerSceneJson(text, modelName);
      } catch (err) {
        console.error("Failed to drop load JSON file:", err);
      }
    }
  });
}
