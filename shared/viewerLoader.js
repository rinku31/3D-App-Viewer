/**
 * Shared Viewer Asset Loader Module
 * Handles GLB/GLTF/Draco 3D model loading, resource disposal, auto-framing via CameraRig,
 * and JSON scene loading with automatic migration and schema validation.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { disposeHierarchy } from "./disposal.js";
import {
  createDefaultSceneDocument,
  migrateSceneDocument,
  validateSceneDocument,
  sanitizeAssetUrl
} from "./schema.js";
import { syncSceneLights } from "./lights.js";
import { buildHotspotOverlays, clearHotspotOverlays } from "./hotspotOverlay.js";

// Cached loaders with preloaded Draco decoder
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
dracoLoader.preload();

const gltfLoader = new GLTFLoader();
gltfLoader.setCrossOrigin("anonymous");
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Loads a GLB/GLTF 3D model from a URL, ArrayBuffer, or File object.
 * @param {object} viewerState - Active viewer state object
 * @param {string | File | ArrayBuffer} source - URL string, File, or ArrayBuffer
 * @param {string} [modelName] - Optional display name of the model
 * @param {object | File | string} [companionJson] - Optional companion scene JSON
 * @param {File[]} [allFiles] - Optional companion files (textures, bin)
 */
export async function loadViewerModel(
  viewerState,
  source,
  modelName = "Product",
  companionJson = null,
  allFiles = []
) {
  let url = source;
  let isBlob = false;
  const fileUrlMap = new Map();

  if (source instanceof File) {
    if (allFiles && allFiles.length > 1) {
      allFiles.forEach((f) => {
        fileUrlMap.set(f.name, URL.createObjectURL(f));
      });

      gltfLoader.manager.setURLModifier((u) => {
        const cleanName = u.split("/").pop().split("?")[0];
        if (fileUrlMap.has(cleanName)) {
          return fileUrlMap.get(cleanName);
        }
        return u;
      });

      url = fileUrlMap.get(source.name) || URL.createObjectURL(source);
    } else {
      url = URL.createObjectURL(source);
    }
    isBlob = true;
    modelName = source.name.replace(/\.[^/.]+$/, "");
  } else if (typeof source === "string") {
    url = sanitizeAssetUrl(source);
  }

  showViewerLoading(viewerState, `Loading 3D Model: ${modelName}...`);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      async (gltf) => {
        hideViewerLoading(viewerState);

        // 1. Dispose Previous Model cleanly
        if (viewerState.currentModel) {
          viewerState.scene.remove(viewerState.currentModel);
          disposeHierarchy(viewerState.currentModel);
          viewerState.currentModel = null;
        }

        const model = gltf.scene || gltf.scenes[0];
        model.name = modelName;

        // Enable shadow casting and receiving on all child meshes
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.side = THREE.DoubleSide;
            }
          }
        });

        viewerState.currentModel = model;
        viewerState.scene.add(model);

        // 2. Center and Auto-Frame Camera to Model Dimensions
        if (viewerState.cameraRig) {
          viewerState.cameraRig.fitToObject(model, 1.35);
        }

        // 3. Ingest Companion Scene JSON if available
        if (companionJson) {
          try {
            let jsonObj = companionJson;
            if (companionJson instanceof File) {
              const text = await companionJson.text();
              jsonObj = JSON.parse(text);
            } else if (typeof companionJson === "string") {
              if (companionJson.trim().startsWith("{")) {
                jsonObj = JSON.parse(companionJson);
              } else {
                const res = await fetch(companionJson, { mode: "cors" });
                if (res.ok) jsonObj = await res.json();
              }
            }
            loadViewerSceneJson(viewerState, jsonObj, modelName);
          } catch (err) {
            console.warn("Could not load companion scene JSON:", err);
            // Default scene fallback
            loadViewerSceneJson(viewerState, null, modelName);
          }
        } else {
          // Initialize default empty schema for this model
          loadViewerSceneJson(viewerState, null, modelName);
        }

        // 4. Revoke Object URLs if blob
        if (isBlob && url) {
          URL.revokeObjectURL(url);
          fileUrlMap.forEach((u) => URL.revokeObjectURL(u));
        }

        // 5. Emit viewer ready event
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              {
                type: "3D_VIEWER_READY",
                modelName: model.name,
                hotspotCount: viewerState.hotspots?.length || 0
              },
              "*"
            );
          }
        } catch (_) {}

        resolve(model);
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          showViewerLoading(viewerState, `Loading 3D Model: ${percent}%`);
        }
      },
      (error) => {
        hideViewerLoading(viewerState);
        console.error("Failed to load 3D GLTF model:", error);
        reject(error);
      }
    );
  });
}

/**
 * Parses and loads a Schema v2 JSON scene document, syncing lighting, environment, and hotspots.
 * @param {object} viewerState - Active viewer state object
 * @param {object | string} [jsonInput] - JSON scene document object or JSON string
 * @param {string} [fallbackModelName] - Default fallback title
 */
export function loadViewerSceneJson(viewerState, jsonInput = null, fallbackModelName = "Product") {
  let doc = null;

  try {
    if (typeof jsonInput === "string") {
      doc = JSON.parse(jsonInput);
    } else if (jsonInput && typeof jsonInput === "object") {
      doc = jsonInput;
    }
  } catch (err) {
    console.error("Invalid Scene JSON input:", err);
  }

  // 1. Auto-Migrate and Validate Document
  if (!doc) {
    doc = createDefaultSceneDocument(fallbackModelName);
  } else {
    doc = migrateSceneDocument(doc);
    const validation = validateSceneDocument(doc);
    if (!validation.valid) {
      console.warn("Schema validation warnings:", validation.errors);
    }
  }

  viewerState.sceneDocument = doc;

  // 2. Apply Scene Settings (Environment, Background, Bloom)
  applyViewerSceneSettings(viewerState, doc.settings);

  // 3. Synchronize Scene Lights
  syncViewerLights(viewerState);

  // 4. Build Hotspots & Annotation Overlays
  buildHotspotOverlays(viewerState);

  // 5. Update HUD Info
  const sceneTitle = doc.metadata?.title || fallbackModelName;
  if (viewerState.updateHudInfo) {
    viewerState.updateHudInfo(sceneTitle);
  }

  // 6. If scene JSON defines a modelUrl and no model is currently loaded, load it
  if (doc.metadata?.modelUrl && !viewerState.currentModel) {
    loadViewerModel(viewerState, doc.metadata.modelUrl, sceneTitle).catch((err) => {
      console.warn("Could not auto-load model from scene metadata:", err);
    });
  }
}

/**
 * Applies Environment, Background, and Bloom settings from Schema settings.
 */
export function applyViewerSceneSettings(viewerState, settings = {}) {
  if (!settings) return;

  // 1. Environment & Background
  if (viewerState.environmentManager) {
    const env = settings.environment || {};
    const bgType = settings.backgroundType || "color";
    const bgVal = settings.background || "#222228";
    const blur = settings.backgroundBlur || 0;

    viewerState.environmentManager.applyBackground({
      background: bgVal,
      backgroundType: bgType,
      backgroundBlur: blur
    });

    if (env.preset) {
      viewerState.environmentManager.loadEnvironment(env.preset, {
        intensity: env.intensity ?? 1.0,
        rotation: env.rotation ?? 0
      });
    }
  }

  // 2. Bloom Post-Processing
  if (viewerState.bloomManager) {
    const bloom = settings.bloom || {};
    viewerState.bloom = {
      enabled: Boolean(bloom.enabled),
      strength: bloom.strength ?? 0.6,
      radius: bloom.radius ?? 0.4,
      threshold: bloom.threshold ?? 0.85
    };
    viewerState.bloomManager.setEnabled(viewerState.bloom.enabled);
    viewerState.bloomManager.setParams(viewerState.bloom);
  }
}

/**
 * Synchronizes lights in the scene with the current scene document.
 */
export function syncViewerLights(viewerState) {
  if (!viewerState.scene) return;

  const lightsData = viewerState.sceneDocument?.lights;

  if (Array.isArray(lightsData) && lightsData.length > 0) {
    if (viewerState.defaultAmbientLight) viewerState.defaultAmbientLight.visible = false;
    if (viewerState.defaultDirectionalLight) viewerState.defaultDirectionalLight.visible = false;

    viewerState.customLights = syncSceneLights(
      viewerState.scene,
      lightsData,
      viewerState.customLights
    );
  } else {
    if (viewerState.defaultAmbientLight) viewerState.defaultAmbientLight.visible = true;
    if (viewerState.defaultDirectionalLight) viewerState.defaultDirectionalLight.visible = true;

    viewerState.customLights = syncSceneLights(viewerState.scene, [], viewerState.customLights);
  }
}

/**
 * Shows the animated loading overlay spinner with text.
 */
export function showViewerLoading(viewerState, text = "Loading...") {
  let overlay = document.getElementById("viewerLoadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "viewerLoadingOverlay";
    overlay.className = "viewer-loading-overlay";
    overlay.innerHTML = `
      <div class="viewer-spinner"></div>
      <div id="viewerLoadingText" class="viewer-loading-text">${text}</div>
    `;
    document.body.appendChild(overlay);
  }

  const label = document.getElementById("viewerLoadingText");
  if (label) label.textContent = text;
  overlay.classList.remove("hidden");
}

/**
 * Hides the loading overlay spinner.
 */
export function hideViewerLoading(viewerState) {
  const overlay = document.getElementById("viewerLoadingOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}
