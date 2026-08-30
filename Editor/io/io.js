import * as THREE from "three";

import { clearSelection, notifySelectionChanged, state } from "../state/state.js";
import { buildHotspot, removeHotspot } from "../hotspots/hotspots.js";
import {
  clearAllLights,
  createAmbientLight,
  createAreaLight,
  createDirectionalLight,
  createPointLight,
  createSpotLight,
  setLightVisibility
} from "../lights/lights.js";
import {
  applyBackgroundSettings,
  applyBloomSettings,
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

    const maxAnisotropy = state.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
    state.currentModel.traverse((obj) => {
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
    const importedBloom = data.scene.rendering?.bloom || data.scene.bloom || data.bloom;
    if (importedBloom && typeof importedBloom === "object") {
      applyBloomSettings(importedBloom);
    }
    if (data.scene.helpers) {
      setGridVisible(data.scene.helpers.grid !== false);
      setAxesVisible(Boolean(data.scene.helpers.axes));
    }
  }

  // Restore line, hotspots and controls settings
  if (data.settings) {
    if (data.settings.line) {
      if (!state.sceneSettings.line) state.sceneSettings.line = {};
      Object.assign(state.sceneSettings.line, data.settings.line);
    }
    if (data.settings.hotspots) {
      if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
      Object.assign(state.sceneSettings.hotspots, data.settings.hotspots);
    }
    if (data.settings.controls) {
      if (!state.sceneSettings.controls) state.sceneSettings.controls = {};
      Object.assign(state.sceneSettings.controls, data.settings.controls);
    }
  } else if (data.scene?.controls) {
    if (!state.sceneSettings.controls) state.sceneSettings.controls = {};
    Object.assign(state.sceneSettings.controls, data.scene.controls);
  }

  // 2. Restore Camera Settings & Default View
  if (data.camera && state.cameraRig) {
    const minPitch = typeof data.camera.minPitch === "number" ? data.camera.minPitch : -82;
    const maxPitch = typeof data.camera.maxPitch === "number" ? data.camera.maxPitch : 82;
    const camState = {
      target: Array.isArray(data.camera.target) ? data.camera.target : [0, 0, 0],
      yaw: typeof data.camera.yaw === "number" ? data.camera.yaw : 0.0,
      pitch: typeof data.camera.pitch === "number" ? data.camera.pitch : 0.2,
      distance: typeof data.camera.distance === "number" ? data.camera.distance : 4.0,
      fov: typeof data.camera.fov === "number" ? data.camera.fov : 45,
      minDistance: typeof data.camera.minDistance === "number" ? data.camera.minDistance : undefined,
      maxDistance: typeof data.camera.maxDistance === "number" ? data.camera.maxDistance : undefined,
      minPitch: minPitch,
      maxPitch: maxPitch
    };
    state.cameraRig.setDefaultState(camState);
    state.cameraRig.setState(camState);
    state.cameraSettings.fov = camState.fov;
    if (typeof camState.minDistance === "number") state.cameraSettings.minDistance = camState.minDistance;
    if (typeof camState.maxDistance === "number") state.cameraSettings.maxDistance = camState.maxDistance;
    state.cameraSettings.minPitch = minPitch;
    state.cameraSettings.maxPitch = maxPitch;
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
      const typeLower = String(l.type || "directional").toLowerCase();
      if (typeLower.includes("point")) {
        createPointLight({ ...l, select: false });
      } else if (typeLower.includes("spot")) {
        createSpotLight({ ...l, select: false });
      } else if (typeLower.includes("area") || typeLower.includes("rect")) {
        createAreaLight({ ...l, select: false });
      } else if (typeLower.includes("ambient")) {
        createAmbientLight({ ...l, select: false });
      } else {
        createDirectionalLight({ ...l, select: false });
      }
      
      const newLight = state.lights[state.lights.length - 1];
      if (newLight) {
        newLight.locked = Boolean(l.locked);
        if (l.visible !== undefined) {
          setLightVisibility(newLight, Boolean(l.visible !== false));
        }
      }
    });

    if (state.lights.length > 0) {
      select("light", state.lights[0]);
    }
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
        visible: Boolean(h.visible !== false),
        locked: Boolean(h.locked),
        sections: Array.isArray(h.sections) ? h.sections.map(sec => ({
          description: sec.description ?? "",
          listItems: Array.isArray(sec.listItems) ? sec.listItems.map(item => String(item || "")) : [],
          buttons: Array.isArray(sec.buttons) ? sec.buttons.map(b => ({
            enabled: Boolean(b.enabled),
            text: b.text || "Show Article",
            url: b.url || "",
            jsFunction: b.jsFunction || ""
          })) : []
        })) : [],
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

function serializeSceneDocument() {
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

  const minPitch = typeof state.cameraRig?.getMinPitchDeg === "function"
    ? state.cameraRig.getMinPitchDeg()
    : (typeof state.cameraSettings?.minPitch === "number"
      ? state.cameraSettings.minPitch
      : -82);

  const maxPitch = typeof state.cameraRig?.getMaxPitchDeg === "function"
    ? state.cameraRig.getMaxPitchDeg()
    : (typeof state.cameraSettings?.maxPitch === "number"
      ? state.cameraSettings.maxPitch
      : 82);

  return {
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
        shadowType: "pcfsoft",
        bloom: {
          enabled: Boolean(state.sceneSettings.bloom?.enabled),
          strength: Number(state.sceneSettings.bloom?.strength ?? 0.6),
          radius: Number(state.sceneSettings.bloom?.radius ?? 0.4),
          threshold: Number(state.sceneSettings.bloom?.threshold ?? 0.85)
        }
      },
      bloom: {
        enabled: Boolean(state.sceneSettings.bloom?.enabled),
        strength: Number(state.sceneSettings.bloom?.strength ?? 0.6),
        radius: Number(state.sceneSettings.bloom?.radius ?? 0.4),
        threshold: Number(state.sceneSettings.bloom?.threshold ?? 0.85)
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
      minPitch: Number(minPitch),
      maxPitch: Number(maxPitch),
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
      const rawType = (l.type || "directional").toLowerCase();
      let type = "directional";
      if (rawType.includes("point")) type = "point";
      else if (rawType.includes("spot")) type = "spot";
      else if (rawType.includes("area") || rawType.includes("rect")) type = "area";
      else if (rawType.includes("ambient")) type = "ambient";

      const defaultName = type === "area" ? "Area Softbox" : `${type.charAt(0).toUpperCase() + type.slice(1)} Light`;
      const entry = {
        id: l.id,
        name: l.name || defaultName,
        type: type,
        color: l.color || "#ffffff",
        intensity: typeof l.intensity === "number" ? l.intensity : (type === "area" ? 15.0 : 2.0),
        castShadow: Boolean(l.castShadow),
        visible: Boolean(l.visible !== false),
        locked: Boolean(l.locked),
      };
      if (l.light?.position) {
        entry.position = [l.light.position.x, l.light.position.y, l.light.position.z];
      } else if (Array.isArray(l.position)) {
        entry.position = [...l.position];
      }
      if (l.target?.position) {
        entry.target = [l.target.position.x, l.target.position.y, l.target.position.z];
      } else if (Array.isArray(l.target)) {
        entry.target = [...l.target];
      }

      if (type === "area") {
        entry.width = typeof l.width === "number" ? l.width : (l.light?.width !== undefined ? Number(l.light.width) : 2.5);
        entry.height = typeof l.height === "number" ? l.height : (l.light?.height !== undefined ? Number(l.light.height) : 2.5);
      }
      if (type === "point" || type === "spot") {
        if (l.distance !== undefined) entry.distance = l.distance;
        if (l.decay !== undefined) entry.decay = l.decay;
      }
      if (type === "spot") {
        if (l.angle !== undefined) entry.angle = l.angle;
        if (l.penumbra !== undefined) entry.penumbra = l.penumbra;
      }
      if (type !== "ambient" && type !== "area") {
        if (l.radius !== undefined) entry.radius = l.radius;
      }
      return entry;
    }),
    settings: {
      line: {
        color: state.sceneSettings?.line?.color || "#44D62C",
        style: state.sceneSettings?.line?.style || "dashed",
        width: typeof state.sceneSettings?.line?.width === "number" ? state.sceneSettings.line.width : 1.5,
        offset: state.sceneSettings?.line?.offset || { x: 0, y: 0 }
      },
      hotspots: {
        panelColor: state.sceneSettings?.hotspots?.panelColor || "rgba(30, 30, 36, 0.95)",
        pulseAnimation: state.sceneSettings?.hotspots?.pulseAnimation !== false,
        theme: state.sceneSettings?.hotspots?.theme || "default",
        occlusionTolerance: typeof state.sceneSettings?.hotspots?.occlusionTolerance === "number" ? state.sceneSettings.hotspots.occlusionTolerance : 0.08
      },
      controls: {
        defaultEnabled: state.sceneSettings?.controls?.defaultEnabled !== false,
        explodeEnabled: state.sceneSettings?.controls?.explodeEnabled !== false,
        simulatorEnabled: state.sceneSettings?.controls?.simulatorEnabled !== false,
        simulatorJsFunction: state.sceneSettings?.controls?.simulatorJsFunction || "onSimulatorToggle",
        simulatorUrl: state.sceneSettings?.controls?.simulatorUrl || ""
      }
    },
    hotspots: state.hotspots.map((h) => ({
      id: h.id,
      title: h.title,
      visible: Boolean(h.visible !== false),
      locked: Boolean(h.locked),
      sections: Array.isArray(h.sections) ? h.sections.map(sec => ({
        description: sec.description,
        listItems: Array.isArray(sec.listItems) ? [...sec.listItems] : [],
        buttons: Array.isArray(sec.buttons) ? sec.buttons.map(b => ({
          enabled: Boolean(b.enabled),
          text: b.text || "Show Article",
          url: b.url || "",
          jsFunction: b.jsFunction || ""
        })) : []
      })) : [],
      position: h.position,
      panelOffset: h.panelOffset,
      ...(h.color ? { color: h.color } : {}),
      ...(h.cameraViewpointId ? { cameraViewpointId: h.cameraViewpointId } : {})
    })),
  };
}

function getSuggestedFilename() {
  if (state.importedJsonFileName) {
    return state.importedJsonFileName.endsWith(".json")
      ? state.importedJsonFileName
      : `${state.importedJsonFileName}.json`;
  }
  if (state.currentModel?.name) {
    return `${state.currentModel.name}.json`;
  }
  return "scene.json";
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
  const filenameInput = document.getElementById("exportModalFilenameInput");
  const warningElem = document.getElementById("exportModalWarning");
  const noticeElem = document.getElementById("exportModalNotice");
  const noticeTextElem = document.getElementById("exportModalNoticeText");

  const modelName = state.currentModel?.name || null;
  const suggestedFilename = getSuggestedFilename();

  if (modelNameElem) modelNameElem.textContent = modelName || "None (No 3D Model Loaded)";
  if (hotspotsCountElem) hotspotsCountElem.textContent = state.hotspots.length.toString();
  if (lightsCountElem) lightsCountElem.textContent = state.lights.length.toString();
  if (filenameInput) filenameInput.value = suggestedFilename;

  if (warningElem) {
    warningElem.style.display = modelName ? "none" : "flex";
  }

  if (noticeElem) {
    const isIframe = window.self !== window.top;
    if (isIframe && typeof window.showSaveFilePicker !== "undefined") {
      noticeElem.style.display = "block";
      if (noticeTextElem) {
        noticeTextElem.textContent = "Tip: When inside embedded preview frames, browser security may restrict the OS picker and fallback to direct download. Open directly in a browser tab for full native OS Save As dialog.";
      }
    } else {
      noticeElem.style.display = "none";
    }
  }

  modal.style.display = "flex";
  setTimeout(() => {
    if (filenameInput) {
      filenameInput.focus();
      filenameInput.select();
    }
  }, 50);
}

function hideExportConfirmationDialog() {
  const modal = document.getElementById("exportModal");
  if (modal) modal.style.display = "none";
}

function sanitizeFilename(rawName) {
  let name = (rawName || "").trim();
  if (!name) name = getSuggestedFilename();
  if (!/\.json$/i.test(name)) {
    name += ".json";
  }
  return name.replace(/[/\\?%*:|"<>]/g, "_");
}

async function exportWithSaveFilePicker(filename, jsonContent) {
  // Try File System Access API (showSaveFilePicker) in Chromium / Supported Browsers
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
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
      hideExportConfirmationDialog();
      return true;
    } catch (err) {
      if (err.name === "AbortError") {
        // User clicked cancel in OS file picker dialog
        return false;
      }
      console.warn("showSaveFilePicker not permitted in this context, falling back to download:", err);
    }
  }

  // Fallback for browsers or embedded contexts without File System Access API
  triggerBrowserDownload(jsonContent, filename);
  hideExportConfirmationDialog();
  return true;
}

async function exportJson(requestedFilename) {
  const filename = sanitizeFilename(
    requestedFilename ||
    document.getElementById("exportModalFilenameInput")?.value ||
    getSuggestedFilename()
  );

  const exportData = serializeSceneDocument();
  const jsonContent = JSON.stringify(exportData, null, 2);

  await exportWithSaveFilePicker(filename, jsonContent);
}

function triggerBrowserDownload(content, filename) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyExportJsonToClipboard() {
  const exportData = serializeSceneDocument();
  const jsonContent = JSON.stringify(exportData, null, 2);
  const copyBtnText = document.getElementById("copyBtnText");
  const copyBtnIcon = document.getElementById("copyBtnIcon");

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(jsonContent);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = jsonContent;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    if (copyBtnText) copyBtnText.textContent = "Copied to Clipboard!";
    if (copyBtnIcon) copyBtnIcon.textContent = "✓";
    setTimeout(() => {
      if (copyBtnText) copyBtnText.textContent = "Copy JSON";
      if (copyBtnIcon) copyBtnIcon.textContent = "📋";
    }, 2000);
  } catch (err) {
    console.error("Failed to copy JSON to clipboard:", err);
    if (copyBtnText) copyBtnText.textContent = "Failed to copy";
    setTimeout(() => {
      if (copyBtnText) copyBtnText.textContent = "Copy JSON";
    }, 2000);
  }
}

function bindIO(loader) {
  const modelInput = document.getElementById("modelInput");
  const viewport = document.getElementById("viewport");
  const exportModal = document.getElementById("exportModal");
  const filenameInput = document.getElementById("exportModalFilenameInput");

  // Wire export JSON triggers to confirmation dialog
  const triggerExportDialog = (e) => {
    if (e) e.preventDefault();
    showExportConfirmationDialog();
  };

  document.getElementById("exportBtn")?.addEventListener("click", triggerExportDialog);
  document.getElementById("menuExportJsonBtn")?.addEventListener("click", triggerExportDialog);

  // Modal actions
  document.getElementById("confirmExportModalBtn")?.addEventListener("click", () => {
    exportJson();
  });

  document.getElementById("downloadExportModalBtn")?.addEventListener("click", () => {
    const filename = sanitizeFilename(filenameInput?.value || getSuggestedFilename());
    const exportData = serializeSceneDocument();
    triggerBrowserDownload(JSON.stringify(exportData, null, 2), filename);
    hideExportConfirmationDialog();
  });

  document.getElementById("copyExportJsonBtn")?.addEventListener("click", () => {
    copyExportJsonToClipboard();
  });

  document.getElementById("cancelExportModalBtn")?.addEventListener("click", hideExportConfirmationDialog);
  document.getElementById("closeExportModalBtn")?.addEventListener("click", hideExportConfirmationDialog);

  // Close modal on backdrop click
  if (exportModal) {
    exportModal.addEventListener("click", (e) => {
      if (e.target === exportModal) {
        hideExportConfirmationDialog();
      }
    });
  }

  // Keyboard shortcut Ctrl+S / Cmd+S to export scene JSON, Enter to confirm, Escape to cancel
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      showExportConfirmationDialog();
      return;
    }

    if (exportModal && exportModal.style.display !== "none") {
      if (e.key === "Escape") {
        e.preventDefault();
        hideExportConfirmationDialog();
      } else if (e.key === "Enter" && document.activeElement === filenameInput) {
        e.preventDefault();
        exportJson();
      }
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
  importModel,
  serializeSceneDocument
};
