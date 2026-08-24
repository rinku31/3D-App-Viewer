import * as THREE from "three";

import { clearSelection, notifySelectionChanged, state } from "../state/state.js";
import { buildHotspot, removeHotspot } from "../hotspots/hotspots.js";
import {
  clearAllLights,
  createAmbientLight,
  createAreaLight,
  createDirectionalLight,
  createPointLight,
  createSpotLight
} from "../lights/lights.js";
import {
  applyBackgroundSettings,
  applyEnvironmentParams,
  frameModel,
  loadEnvironment,
  setAxesVisible,
  setGridVisible,
  setShadowsEnabled
} from "../render/render.js";
import { select } from "../selection/selection.js";
import { disposeHierarchy } from "../../shared/disposal.js";
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultSceneDocument,
  migrateSceneDocument,
  validateSceneDocument
} from "./schema.js";

async function tryAutoLoadEditorSceneJson(modelName) {
  if (!modelName || modelName === "Product Model") return false;

  const candidatePaths = [
    `/Viewer/assets/Products/${modelName}.json`,
    `/Viewer/assets/Products/${encodeURIComponent(modelName)}.json`,
    `/Viewer/assets/Products/${modelName.trim()}.json`,
    `/Viewer/assets/Products/${modelName.replace(/\s+/g, "_")}.json`,
    `/Viewer/assets/Products/${modelName.replace(/_/g, " ")}.json`,
    `/assets/Products/${modelName}.json`,
    `/assets/Products/${encodeURIComponent(modelName)}.json`,
    `/assets/${modelName}.json`,
    `/${modelName}.json`,
    `/${encodeURIComponent(modelName)}.json`
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
        if (data && (data.hotspots || data.version || data.scene || data.camera || data.lights)) {
          console.info(`[Editor] Automatically loaded matching scene JSON for "${modelName}" from ${path}`);
          await importJsonData(data, `${modelName}.json`);
          return true;
        }
      }
    } catch (_) {}
  }
  return false;
}

async function importModel(loader, file, companionJson = null, allFiles = []) {
  if (!file) return null;

  // If a JSON document was mistakenly passed to importModel, redirect gracefully
  if (file.name.toLowerCase().endsWith(".json")) {
    console.info(`[Editor] Routing JSON file "${file.name}" to importJson.`);
    return importJson(file);
  }

  const modelName = file.name.replace(/\.[^/.]+$/, "");
  const fileUrlMap = new Map();
  let gltfUrl = null;

  try {
    // If multiple companion files (textures, .bin) are provided with .gltf
    if (allFiles && allFiles.length > 1) {
      allFiles.forEach((f) => {
        fileUrlMap.set(f.name, URL.createObjectURL(f));
      });

      const originalUrlModifier = loader.manager.urlModifier;
      loader.manager.setURLModifier((url) => {
        const cleanName = url.split("/").pop().split("?")[0];
        if (fileUrlMap.has(cleanName)) {
          return fileUrlMap.get(cleanName);
        }
        return url;
      });

      gltfUrl = fileUrlMap.get(file.name) || URL.createObjectURL(file);
    } else {
      gltfUrl = URL.createObjectURL(file);
    }

    const gltf = await loader.loadAsync(gltfUrl);

    if (state.currentModel) {
      disposeHierarchy(state.currentModel, true);
      state.currentModel = null;
    }

    state.currentModel = gltf.scene;
    state.currentModel.name = modelName;
    state.scene.add(state.currentModel);

    state.currentModel.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.envMapIntensity = 2.5;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    frameModel(state.currentModel);

    // If companion JSON file was provided with model selection, load it
    if (companionJson) {
      if (companionJson instanceof File) {
        await importJson(companionJson);
      } else if (typeof companionJson === "object") {
        await importJsonData(companionJson, `${modelName}.json`);
      }
    } else {
      // Attempt to auto-load matching JSON file with the same filename as GLB
      await tryAutoLoadEditorSceneJson(modelName);
    }

    notifySelectionChanged();
    return state.currentModel;
  } catch (error) {
    console.error("Unable to import 3D model:", error);
    throw error;
  } finally {
    if (gltfUrl) {
      URL.revokeObjectURL(gltfUrl);
    }
    fileUrlMap.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
  }
}

async function importJsonData(rawData, fileName = "scene.json") {
  state.importedJsonFileName = fileName;

  // Run schema validation
  const validation = validateSceneDocument(rawData);
  if (!validation.valid) {
    console.warn("Scene validation encountered issues:", validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.info("Scene validation warnings:", validation.warnings);
  }

  // Migrate document if needed to ensure Schema v2 conformity
  const data = migrateSceneDocument(rawData, state.currentModel?.name || "Product Model");
  state.sceneDocument = data;

  // 1. Restore Scene Settings
  if (data.scene) {
    Object.assign(state.sceneSettings, data.scene);
    if (data.scene.environment) {
      Object.assign(state.sceneSettings.environment, data.scene.environment);
      if (data.scene.environment.preset) {
        loadEnvironment(data.scene.environment.preset);
      }
      applyEnvironmentParams();
    }
    applyBackgroundSettings();

    if (data.scene.rendering) {
      setShadowsEnabled(data.scene.rendering.shadows !== false);
    }
    if (data.scene.helpers) {
      setGridVisible(data.scene.helpers.grid !== false);
      setAxesVisible(Boolean(data.scene.helpers.axes));
    }
  }

  // 2. Restore Camera Settings & Default View
  if (data.camera && state.cameraRig) {
    const camState = {
      target: Array.isArray(data.camera.target) ? data.camera.target : [0, 0, 0],
      yaw: typeof data.camera.yaw === "number" ? data.camera.yaw : 0.0,
      pitch: typeof data.camera.pitch === "number" ? data.camera.pitch : 0.2,
      distance: typeof data.camera.distance === "number" ? data.camera.distance : 4.0,
      fov: typeof data.camera.fov === "number" ? data.camera.fov : 45,
      minDistance: typeof data.camera.minDistance === "number" ? data.camera.minDistance : undefined,
      maxDistance: typeof data.camera.maxDistance === "number" ? data.camera.maxDistance : undefined
    };
    state.cameraRig.setDefaultState(camState);
    state.cameraRig.setState(camState);
    state.cameraSettings.fov = camState.fov;
    if (typeof camState.minDistance === "number") state.cameraSettings.minDistance = camState.minDistance;
    if (typeof camState.maxDistance === "number") state.cameraSettings.maxDistance = camState.maxDistance;
  }

  // 3. Restore Model Transforms
  if (data.model && state.currentModel) {
    if (data.model.rotation) {
      state.currentModel.rotation.set(
        Number(data.model.rotation.x) || 0,
        Number(data.model.rotation.y) || 0,
        Number(data.model.rotation.z) || 0
      );
    }
    if (Array.isArray(data.model.position) && data.model.position.length === 3) {
      state.currentModel.position.set(
        Number(data.model.position[0]),
        Number(data.model.position[1]),
        Number(data.model.position[2])
      );
    }
    if (Array.isArray(data.model.scale) && data.model.scale.length === 3) {
      state.currentModel.scale.set(
        Number(data.model.scale[0]),
        Number(data.model.scale[1]),
        Number(data.model.scale[2])
      );
    }
  }

  // 4. Restore Lights
  if (Array.isArray(data.lights)) {
    clearAllLights();
    data.lights.forEach((l) => {
      const typeLower = (l.type || "directional").toLowerCase();
      if (typeLower === "point" || typeLower === "pointlight") {
        createPointLight(l);
      } else if (typeLower === "spot" || typeLower === "spotlight") {
        createSpotLight(l);
      } else if (typeLower === "area" || typeLower === "arealight" || typeLower === "rectarea" || typeLower === "rectarealight") {
        createAreaLight(l);
      } else if (typeLower === "ambient" || typeLower === "ambientlight") {
        createAmbientLight(l);
      } else {
        createDirectionalLight(l);
      }
    });
  }

  // 5. Restore Hotspots
  clearSelection("hotspot");

  [...state.hotspots].forEach((h) => {
    removeHotspot(h);
  });
  state.hotspots.length = 0;

  if (Array.isArray(data.hotspots)) {
    data.hotspots.forEach((h) => {
      const hotspot = {
        id: h.id || ("hotspot_" + Math.random().toString(36).slice(2)),
        title: h.title ?? "",
        description: h.description ?? "",
        position: Array.isArray(h.position)
          ? [Number(h.position[0]) || 0, Number(h.position[1]) || 0, Number(h.position[2]) || 0]
          : [0, 0, 0],
        panelOffset: h.panelOffset
          ? { x: Number(h.panelOffset.x) || 0, y: Number(h.panelOffset.y) || 0 }
          : { x: 250, y: -120 },
        color: h.color,
        cameraViewpointId: h.cameraViewpointId
      };
      state.hotspots.push(hotspot);
      buildHotspot(hotspot);
    });
  }

  notifySelectionChanged();
  return data;
}

async function importJson(file) {
  const text = await file.text();
  let rawData;
  try {
    rawData = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }
  return importJsonData(rawData, file.name);
}

function showExportConfirmationDialog() {
  const modal = document.getElementById("exportModal");
  if (!modal) {
    exportJson();
    return;
  }

  const modelNameElem = document.getElementById("exportModalModelName");
  const hotspotsCountElem = document.getElementById("exportModalHotspotsCount");
  const lightsCountElem = document.getElementById("exportModalLightsCount");
  const filenameElem = document.getElementById("exportModalFilename");
  const warningElem = document.getElementById("exportModalWarning");

  const modelName = state.currentModel?.name || null;
  const outputFilename = state.importedJsonFileName || (modelName ? `${modelName}.json` : "scene.json");

  if (modelNameElem) modelNameElem.textContent = modelName || "None (No 3D Model Loaded)";
  if (hotspotsCountElem) hotspotsCountElem.textContent = state.hotspots.length.toString();
  if (lightsCountElem) lightsCountElem.textContent = state.lights.length.toString();
  if (filenameElem) filenameElem.textContent = outputFilename;

  if (warningElem) {
    warningElem.style.display = modelName ? "none" : "flex";
  }

  modal.style.display = "flex";
}

function hideExportConfirmationDialog() {
  const modal = document.getElementById("exportModal");
  if (modal) modal.style.display = "none";
}

async function exportJson() {
  const defaultCam = state.cameraRig?.getDefaultState?.() || {
    target: [0, 0, 0],
    yaw: 0.0,
    pitch: 0.2,
    distance: 4.0,
    fov: state.camera?.fov || 45
  };
  const modelName = state.currentModel?.name || "Product Model";
  const rawTitle = state.sceneDocument?.metadata?.title || modelName;
  const cleanTitle = rawTitle.replace(/\s+Scene$/i, "").trim() || modelName;

  const minDistance = typeof state.cameraRig?.minDistance === "number"
    ? state.cameraRig.minDistance
    : (typeof state.cameraSettings?.minDistance === "number"
      ? state.cameraSettings.minDistance
      : (typeof defaultCam.minDistance === "number" ? defaultCam.minDistance : 1.35));

  const maxDistance = typeof state.cameraRig?.maxDistance === "number"
    ? state.cameraRig.maxDistance
    : (typeof state.cameraSettings?.maxDistance === "number"
      ? state.cameraSettings.maxDistance
      : (typeof defaultCam.maxDistance === "number" ? defaultCam.maxDistance : 16.0));

  const exportData = {
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      title: cleanTitle,
      author: "3D App Author",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generator: "3D App Viewer Editor v2.0.0",
      tags: ["3d", "product-viewer", "interactive"]
    },
    scene: {
      background: state.sceneSettings.background || "#222228",
      backgroundType: state.sceneSettings.backgroundType || "color",
      backgroundBlur: Number(state.sceneSettings.backgroundBlur || 0),
      environment: {
        preset: state.sceneSettings.environment?.preset || "studio_small_09",
        customHdrUrl: null,
        intensity: Number(state.sceneSettings.environment?.intensity ?? 1.0),
        rotation: Number(state.sceneSettings.environment?.rotation ?? 0.0),
        exposure: Number(state.sceneSettings.environment?.exposure ?? 1.0),
        exposureEV: Number(state.sceneSettings.environment?.exposureEV ?? 0.0),
        toneMapping: state.sceneSettings.environment?.toneMapping || "AgX",
        look: state.sceneSettings.environment?.look || "None"
      },
      rendering: {
        shadows: Boolean(state.sceneSettings.rendering?.shadows !== false),
        shadowType: "pcfsoft"
      },
      helpers: {
        grid: Boolean(state.sceneSettings.helpers?.grid !== false),
        axes: Boolean(state.sceneSettings.helpers?.axes)
      }
    },
    camera: {
      fov: defaultCam.fov ?? (state.camera?.fov || 45),
      near: state.camera?.near || 0.01,
      far: state.camera?.far || 1000,
      minDistance: Number(minDistance),
      maxDistance: Number(maxDistance),
      target: defaultCam.target || [0, 0, 0],
      distance: typeof defaultCam.distance === "number" ? defaultCam.distance : 4.0,
      yaw: typeof defaultCam.yaw === "number" ? defaultCam.yaw : 0.0,
      pitch: typeof defaultCam.pitch === "number" ? defaultCam.pitch : 0.0,
      viewpoints: state.cameraSettings?.viewpoints || [],
    },
    model: {
      name: modelName,
      filename: state.currentModel ? `${modelName}.glb` : "",
      position: state.currentModel ? [state.currentModel.position.x, state.currentModel.position.y, state.currentModel.position.z] : [0, 0, 0],
      rotation: state.currentModel ? {
        x: state.currentModel.rotation.x,
        y: state.currentModel.rotation.y,
        z: state.currentModel.rotation.z
      } : { x: 0, y: 0, z: 0 },
      scale: state.currentModel ? [state.currentModel.scale.x, state.currentModel.scale.y, state.currentModel.scale.z] : [1, 1, 1]
    },
    lights: state.lights.map((l) => {
      const entry = {
        id: l.id,
        name: l.name || `${l.type} light`,
        type: l.type || "directional",
        color: l.color,
        intensity: l.intensity,
        castShadow: Boolean(l.castShadow),
      };
      if (l.light?.position) {
        entry.position = [l.light.position.x, l.light.position.y, l.light.position.z];
      }
      if (l.target?.position) {
        entry.target = [l.target.position.x, l.target.position.y, l.target.position.z];
      }
      if (l.distance !== undefined) entry.distance = l.distance;
      if (l.decay !== undefined) entry.decay = l.decay;
      if (l.angle !== undefined) entry.angle = l.angle;
      if (l.penumbra !== undefined) entry.penumbra = l.penumbra;
      return entry;
    }),
    settings: {
      line: {
        color: "#44D62C",
        width: 1.5,
        offset: { x: 0, y: 0 }
      },
      hotspots: {
        pulseAnimation: true,
        theme: "default",
        occlusionTolerance: 0.08
      }
    },
    hotspots: state.hotspots.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      position: h.position,
      panelOffset: h.panelOffset,
      ...(h.color ? { color: h.color } : {}),
      ...(h.cameraViewpointId ? { cameraViewpointId: h.cameraViewpointId } : {})
    })),
  };

  const defaultFilename = state.importedJsonFileName || (state.currentModel?.name ? `${state.currentModel.name}.json` : "scene.json");
  const jsonContent = JSON.stringify(exportData, null, 2);

  // 1. Try File System Access API (showSaveFilePicker) to let user choose exact location & filename
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: defaultFilename,
        types: [
          {
            description: "JSON Scene Document (*.json)",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writableStream = await fileHandle.createWritable();
      await writableStream.write(jsonContent);
      await writableStream.close();
      return;
    } catch (err) {
      // If user canceled the save dialog, do nothing
      if (err.name === "AbortError") {
        return;
      }
      console.warn("showSaveFilePicker unavailable or denied, falling back to download:", err);
    }
  }

  // 2. Fallback: Browser anchor download
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}

function bindIO(loader) {
  const modelInput = document.getElementById("modelInput");
  const viewport = document.getElementById("viewport");
  const exportModal = document.getElementById("exportModal");

  // Wire export JSON confirmation triggers
  const triggerExportJson = () => {
    showExportConfirmationDialog();
  };
  document.getElementById("exportBtn")?.addEventListener("click", triggerExportJson);
  document.getElementById("menuExportJsonBtn")?.addEventListener("click", triggerExportJson);

  // Modal event bindings
  document.getElementById("confirmExportModalBtn")?.addEventListener("click", () => {
    hideExportConfirmationDialog();
    exportJson();
  });
  document.getElementById("cancelExportModalBtn")?.addEventListener("click", hideExportConfirmationDialog);
  document.getElementById("closeExportModalBtn")?.addEventListener("click", hideExportConfirmationDialog);
  
  if (exportModal) {
    exportModal.addEventListener("click", (e) => {
      if (e.target === exportModal) {
        hideExportConfirmationDialog();
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && exportModal && exportModal.style.display !== "none") {
      hideExportConfirmationDialog();
    }
  });

  // Wire single unified import trigger
  const triggerImportFile = () => {
    if (modelInput) modelInput.click();
  };
  document.getElementById("menuImportModelBtn")?.addEventListener("click", triggerImportFile);

  if (modelInput) {
    modelInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const glbFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
      const jsonFile = files.find((f) => /\.json$/i.test(f.name));

      try {
        if (glbFile) {
          await importModel(loader, glbFile, jsonFile, files);
        } else if (jsonFile) {
          await importJson(jsonFile);
        } else {
          alert("Please select a 3D model (.glb or .gltf) or a scene JSON file.");
        }
      } catch (error) {
        console.error("Unable to import file:", error);
        alert(`Failed to load file: ${error.message || "Invalid or unsupported file format."}`);
      } finally {
        modelInput.value = "";
      }
    });
  }

  // Drag and drop onto viewport
  if (viewport) {
    viewport.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    viewport.addEventListener("drop", async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;

      const glbFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
      const jsonFile = files.find((f) => /\.json$/i.test(f.name));

      if (glbFile) {
        try {
          await importModel(loader, glbFile, jsonFile, files);
        } catch (error) {
          console.error("Unable to drop import model.", error);
          alert(`Unable to import 3D model: ${error.message || "Unsupported format"}`);
        }
      } else if (jsonFile) {
        try {
          await importJson(jsonFile);
        } catch (error) {
          console.error("Unable to drop import JSON.", error);
          alert(`Unable to import scene JSON: ${error.message || "Invalid JSON document"}`);
        }
      } else {
        alert("Please drop a 3D model (.glb, .gltf) or a scene JSON file.");
      }
    });
  }
}

export {
  bindIO,
  exportJson,
  importJson,
  importJsonData,
  importModel
};
