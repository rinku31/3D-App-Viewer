/**
 * Viewer Bootstrap Module
 * Coordinates Viewer subsystem initialization, DOM event delegation,
 * and the per-frame update loop.
 */

import { state } from "../state/state.js";
import { initializeRender, startViewerLoop } from "../render/render.js";
import { initializeViewerLights } from "../lights/lights.js";
import { loadViewerModel, loadViewerSceneJson } from "../loading/loader.js";
import { updateHotspotVisibility } from "../visibility/visibility.js";
import { updateOverlayPositions } from "../overlay/overlay.js";
import { initializeViewerHUD, updateHudSceneInfo } from "../ui/hud.js";
import { sanitizeAssetUrl } from "../../shared/schema.js";

/**
 * Bootstraps the entire 3D Viewer application
 */
export async function bootstrapViewer() {
  // 1. Grab DOM references
  state.container = document.body;
  state.overlay = document.getElementById("overlay");
  state.svg = document.getElementById("svg");
  state.modelInput = document.getElementById("modelInput");

  // 2. Initialize Three.js Rendering, CameraRig & Lighting
  initializeRender();
  initializeViewerLights();

  // 3. Initialize Commercial Floating HUD & Controls
  initializeViewerHUD();

  // 4. Bind File Input Handlers
  setupFileListeners();

  // 5. Start Animation / Render Loop
  startViewerLoop((timestamp) => {
    // 5.1 Update Occlusion Visibility
    updateHotspotVisibility();

    // 5.2 Project & Update Hotspot Overlay positions
    updateOverlayPositions();
  });

  // 6. Check URL query parameters for dynamic model / scene injection
  const params = new URLSearchParams(window.location.search);
  const glbRaw = params.get("glb") || params.get("model") || params.get("gltf");
  const jsonRaw = params.get("json") || params.get("scene");
  const glbParam = glbRaw ? sanitizeAssetUrl(glbRaw) : null;
  const jsonParam = jsonRaw ? sanitizeAssetUrl(jsonRaw) : null;
  const titleParam = params.get("title");
  const envParam = params.get("env") || params.get("preset") || "studio_small_09";
  const bgParam = params.get("bg") || params.get("background") || "#222228";

  // 7. Load Environment asynchronously
  state.environmentManager.applyBackground({ background: bgParam, backgroundType: "color" });
  state.environmentManager.loadEnvironment(envParam);
  state.environmentManager.preloadPresets();

  // 8. Ingest query parameters or default demo showcase
  if (glbParam || jsonParam) {
    let companionJsonObject = null;
    if (jsonParam) {
      try {
        const candidates = [
          jsonParam,
          decodeURI(jsonParam),
          `.${jsonParam.startsWith('/') ? '' : '/'}${jsonParam}`,
          `../${jsonParam.replace(/^\/+/, '')}`
        ];
        for (const p of candidates) {
          try {
            const attempt = await fetch(p, { mode: "cors" });
            if (attempt.ok) {
              const contentType = attempt.headers.get("content-type");
              if (!contentType || contentType.includes("json") || contentType.includes("text") || contentType.includes("octet-stream")) {
                companionJsonObject = await attempt.json();
                break;
              }
            }
          } catch (_) {}
        }
      } catch (err) {
        console.warn("Failed to fetch scene JSON:", err);
      }
    }

    if (glbParam) {
      try {
        const cleanNameFromUrl = decodeURIComponent(glbParam.split("/").pop().replace(/\.[^/.]+$/, ""));
        const modelName = titleParam || (companionJsonObject?.metadata?.title) || cleanNameFromUrl || "Product";
        await loadViewerModel(glbParam, modelName, companionJsonObject);
        if (titleParam) updateHudSceneInfo(titleParam);
        return;
      } catch (err) {
        console.warn(`Failed to load GLB model from '${glbParam}':`, err);
      }
    }

    if (companionJsonObject) {
      const modelName = titleParam || companionJsonObject.metadata?.title || "Product";
      loadViewerSceneJson(companionJsonObject, modelName);
      if (titleParam) updateHudSceneInfo(titleParam);
      return;
    }
  }

  // Auto-load default demo showcase if present
  try {
    const res = await fetch("/Viewer/assets/Products/Cube.json");
    if (res.ok) {
      const data = await res.json();
      if (data) {
        loadViewerSceneJson(data, "Cube");
      }
    }
  } catch (_) {}
}

/**
 * Configures DOM file input and button event listeners
 */
function setupFileListeners() {
  // Model Input Listener
  if (state.modelInput) {
    state.modelInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const glbFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
      const jsonFile = files.find((f) => /\.json$/i.test(f.name));

      if (glbFile) {
        const modelBaseName = glbFile.name.replace(/\.[^/.]+$/, "");
        await loadViewerModel(glbFile, modelBaseName, jsonFile, files);
      } else if (jsonFile) {
        try {
          const text = await jsonFile.text();
          const modelName = state.currentModel?.name || jsonFile.name.replace(/\.json$/i, "");
          loadViewerSceneJson(text, modelName);
        } catch (err) {
          console.error("Failed to load scene JSON file:", err);
        }
      }

      // Reset input value so same file can be reloaded if desired
      state.modelInput.value = "";
    });
  }

  // Drag and drop onto document body
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
      await loadViewerModel(glbFile, modelBaseName, jsonFile, files);
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
