/**
 * Embed Viewer Asset Loader Module
 * Handles GLB/GLTF/Draco 3D model loading, resource disposal, auto-framing via CameraRig,
 * and JSON scene loading with automatic migration and schema validation.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { state } from "../state/state.js";
import { disposeHierarchy } from "../../shared/disposal.js";
import { createDefaultSceneDocument, migrateSceneDocument, validateSceneDocument, sanitizeAssetUrl } from "../../shared/schema.js";
import { applyViewerSceneSettings } from "../render/render.js";
import { syncViewerLights } from "../lights/lights.js";
import { buildHotspotOverlays, clearHotspotOverlays } from "../overlay/overlay.js";
import { refreshTourSteps, updateHudSceneInfo, showLoading, hideLoading } from "../ui/hud.js";

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
dracoLoader.preload();

const gltfLoader = new GLTFLoader();
gltfLoader.setCrossOrigin("anonymous");
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Loads a GLB 3D model from a URL or File object.
 * @param {string | File} source - URL string or File object
 * @param {string} [modelName] - Optional name of the model
 * @param {object | File | string} [companionJson] - Optional companion scene JSON
 * @param {File[]} [allFiles] - Optional companion files (textures, bin)
 */
export async function loadViewerModel(source, modelName = "Product", companionJson = null, allFiles = []) {
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

  showLoading(`Loading 3D Model...`);

  try {
    const gltf = await gltfLoader.loadAsync(url);

    // 1. Cleanly dispose previous model
    if (state.currentModel) {
      disposeHierarchy(state.currentModel, true);
      state.currentModel = null;
    }

    // 2. Clear old hotspots and overlays before loading new model
    clearHotspotOverlays();

    const model = gltf.scene;
    model.name = modelName;
    state.currentModel = model;
    state.scene.add(model);

    // 3. Enhance materials, anti-aliased textures & shadows
    const maxAnisotropy = state.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat) => {
          if (!mat) return;
          mat.envMapIntensity = 2.5;
          const texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "clearcoatMap", "clearcoatNormalMap", "transmissionMap", "thicknessMap"];
          texKeys.forEach((key) => {
            if (mat[key] && mat[key].isTexture) {
              mat[key].anisotropy = maxAnisotropy;
              mat[key].minFilter = THREE.LinearMipmapLinearFilter;
              mat[key].magFilter = THREE.LinearFilter;
              mat[key].generateMipmaps = true;
              mat[key].needsUpdate = true;
            }
          });
        });
      }
    });

    // 4. Auto-frame camera rig to model bounding box
    frameViewerModel(model);

    // 5. If companion JSON provided or try auto-loading matching JSON
    let foundMatchingJson = false;
    if (companionJson) {
      if (companionJson instanceof File) {
        const text = await companionJson.text();
        loadViewerSceneJson(text, modelName);
        foundMatchingJson = true;
      } else if (typeof companionJson === "object" || typeof companionJson === "string") {
        loadViewerSceneJson(companionJson, modelName);
        foundMatchingJson = true;
      }
    } else {
      foundMatchingJson = await tryAutoLoadSceneJson(modelName);
    }

    // If no matching JSON exists, initialize a clean empty scene document
    if (!foundMatchingJson) {
      const defaultDoc = createDefaultSceneDocument(modelName);
      state.sceneDocument = defaultDoc;
      applyViewerSceneSettings();
      syncViewerLights();
      clearHotspotOverlays();
      updateHudSceneInfo(modelName);
    }

    return model;
  } catch (err) {
    console.error("Failed to load 3D model:", err);
    throw err;
  } finally {
    hideLoading();
    if (isBlob && url) {
      URL.revokeObjectURL(url);
    }
    fileUrlMap.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
  }
}

/**
 * Frames the CameraRig around the target 3D model
 */
export function frameViewerModel(model = state.currentModel) {
  if (!model || !state.cameraRig) return;
  state.cameraRig.setCollisionObject(model);
  state.cameraRig.focus(model);
  state.visibilityDirty = true;
}

/**
 * Loads and applies a Scene JSON document (with validation & migration)
 * @param {object | string} rawData - Parsed JSON object or JSON string
 * @param {string} [defaultModelName]
 */
export function loadViewerSceneJson(rawData, defaultModelName = "Product") {
  let jsonObj = rawData;
  if (typeof rawData === "string") {
    try {
      jsonObj = JSON.parse(rawData);
    } catch (err) {
      console.error("Failed to parse JSON string:", err);
      return;
    }
  }

  // Validate & Migrate
  const validation = validateSceneDocument(jsonObj);
  if (!validation.valid) {
    console.warn("Viewer scene validation warnings:", validation.errors);
  }

  const migrated = migrateSceneDocument(jsonObj, defaultModelName);
  state.sceneDocument = migrated;

  // Apply Subsystems
  applyViewerSceneSettings();

  // If no 3D model is in scene, generate procedural product geometry so hotspots and lighting have physical presence
  if (!state.currentModel) {
    createProceduralProductModel(defaultModelName);
  }

  applyCameraAndModelTransforms();
  syncViewerLights();
  buildHotspotOverlays();
  refreshTourSteps();

  updateHudSceneInfo(migrated.metadata?.title || defaultModelName);

  state.visibilityDirty = true;
  return migrated;
}

/**
 * Creates a procedural 3D cube model (used when no GLB file is present)
 */
export function createProceduralProductModel(name = "Cube") {
  if (state.currentModel) {
    disposeHierarchy(state.currentModel, true);
    state.currentModel = null;
  }

  const group = new THREE.Group();
  group.name = name;

  // Create refined Cube geometry (2x2x2) with smooth studio shading
  const cubeGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0, 4, 4, 4);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x2e323b,
    roughness: 0.25,
    metalness: 0.35,
    envMapIntensity: 2.2
  });

  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.castShadow = true;
  cubeMesh.receiveShadow = true;
  group.add(cubeMesh);

  state.currentModel = group;
  state.scene.add(group);

  // Auto-frame camera rig to procedural model
  frameViewerModel(group);

  return group;
}

/**
 * Applies camera properties and model transform overrides from the scene document
 */
function applyCameraAndModelTransforms() {
  if (!state.sceneDocument) return;

  // Camera Settings
  const camData = state.sceneDocument.camera;
  if (camData && state.cameraRig) {
    if (state.currentModel) {
      state.cameraRig.setCollisionObject(state.currentModel);
    }
    const camState = {
      target: Array.isArray(camData.target) ? camData.target : [0, 0, 0],
      yaw: typeof camData.yaw === "number" ? camData.yaw : 0,
      pitch: typeof camData.pitch === "number" ? camData.pitch : 0.2,
      distance: typeof camData.distance === "number" ? camData.distance : 4.0,
      fov: typeof camData.fov === "number" ? camData.fov : 45,
      minDistance: typeof camData.minDistance === "number" ? camData.minDistance : undefined,
      maxDistance: typeof camData.maxDistance === "number" ? camData.maxDistance : undefined,
      minPitch: typeof camData.minPitch === "number" ? camData.minPitch : undefined,
      maxPitch: typeof camData.maxPitch === "number" ? camData.maxPitch : undefined
    };

    if (Array.isArray(camData.position) && !camData.yaw && !camData.pitch) {
      const pos = new THREE.Vector3(...camData.position);
      const tgt = new THREE.Vector3(...camState.target);
      camState.distance = pos.distanceTo(tgt) || 4.0;
    }

    state.cameraRig.setDefaultState(camState);
    state.cameraRig.setState(camState);
  }

  // Model Transforms
  const modelData = state.sceneDocument.model;
  if (modelData && state.currentModel) {
    if (modelData.rotation) {
      state.currentModel.rotation.set(
        Number(modelData.rotation.x) || 0,
        Number(modelData.rotation.y) || 0,
        Number(modelData.rotation.z) || 0
      );
    }
    if (Array.isArray(modelData.position)) {
      state.currentModel.position.set(...modelData.position);
    }
    if (Array.isArray(modelData.scale)) {
      state.currentModel.scale.set(...modelData.scale);
    }
  }
}

/**
 * Attempts to auto-load matching scene JSON from assets folder with the same/similar model name.
 */
async function tryAutoLoadSceneJson(modelName) {
  if (!modelName || modelName === "Product") return false;

  const candidatePaths = [
    `/Viewer/assets/Products/${modelName}.json`,
    `/Viewer/assets/Products/${encodeURIComponent(modelName)}.json`,
    `/Viewer/assets/Products/${modelName.trim()}.json`,
    `/Viewer/assets/Products/${modelName.replace(/\s+/g, "_")}.json`,
    `/Viewer/assets/Products/${modelName.replace(/_/g, " ")}.json`,
    `/assets/Products/${modelName}.json`,
    `./assets/Products/${modelName}.json`,
    `/assets/${modelName}.json`,
    `/${modelName}.json`
  ];

  for (const path of candidatePaths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && !contentType.includes("json") && !contentType.includes("text")) {
          continue;
        }
        const data = await res.json();
        if (data && (data.hotspots || data.version || data.scene)) {
          loadViewerSceneJson(data, modelName);
          return true;
        }
      }
    } catch (_) {}
  }
  return false;
}
