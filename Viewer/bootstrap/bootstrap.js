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
import { initializeViewerHUD } from "../ui/hud.js";

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

  // 6. Load Default Environment & Initial Showcase Scene
  state.environmentManager.loadEnvironment("studio_small_09", async () => {
    state.environmentManager.applyBackground({ background: "#222228", backgroundType: "color" });
    
    // Auto-load default demo showcase if present
    try {
      const res = await fetch("/Viewer/assets/Products/Viper V4 Pro.json");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          loadViewerSceneJson(data, "Viper V4 Pro");
        }
      }
    } catch (_) {}
  });
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
        await loadViewerModel(glbFile, modelBaseName, jsonFile);
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
