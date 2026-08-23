import * as THREE from "three";

import { clearSelection, setSelection, state, notifySelectionChanged } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";

import { applyStudioPreset, STUDIO_LIGHTING_PRESETS } from "../../shared/lights.js";

const lightTexture = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/sprites/disc.png"
);

function createLightSprite(colorHex, scale = 0.15) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: lightTexture,
      color: colorHex,
      depthTest: false,
      depthWrite: false,
    })
  );
  sprite.scale.set(scale, scale, scale);
  return sprite;
}

/**
 * Creates a Directional Light in the scene
 */
function createDirectionalLight(options = {}) {
  const color = options.color || "#ffffff";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 3.5;
  const castShadow = options.castShadow !== undefined ? Boolean(options.castShadow) : true;

  const light = new THREE.DirectionalLight(new THREE.Color(color), intensity);
  const pos = options.position || [2, 3, 2];
  light.position.set(pos[0], pos[1], pos[2]);
  light.castShadow = castShadow;

  if (light.shadow) {
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 50;
    light.shadow.bias = -0.0005;
  }

  const target = new THREE.Object3D();
  const targetPos = options.target || [0, 0, 0];
  target.position.set(targetPos[0], targetPos[1], targetPos[2]);
  state.scene.add(target);
  light.target = target;

  state.scene.add(light);

  const lightSprite = createLightSprite(0xffe066, 0.16);
  lightSprite.position.copy(light.position);
  state.scene.add(lightSprite);

  const targetSprite = createLightSprite(0x00e5ff, 0.12);
  targetSprite.position.copy(target.position);
  state.scene.add(targetSprite);

  const helper = new THREE.DirectionalLightHelper(light, 0.4);
  state.scene.add(helper);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    light.position.clone(),
    target.position.clone(),
  ]);
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  state.scene.add(line);

  const lightData = {
    id: options.id || "dir_light_" + Date.now().toString(36),
    name: options.name || "Directional Light",
    type: "directional",
    light,
    helper,
    target,
    lightSprite,
    targetSprite,
    line,
    color,
    intensity,
    castShadow,
  };

  state.lights.push(lightData);
  syncDefaultLightsState();
  if (options.select !== false) {
    selectLight(lightData);
  }
  return lightData;
}

/**
 * Creates a Point Light in the scene
 */
function createPointLight(options = {}) {
  const color = options.color || "#ffaa33";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 25.0;
  const distance = options.distance !== undefined ? Number(options.distance) : 0;
  const decay = options.decay !== undefined ? Number(options.decay) : 2;
  const castShadow = options.castShadow !== undefined ? Boolean(options.castShadow) : true;

  const light = new THREE.PointLight(new THREE.Color(color), intensity, distance, decay);
  const pos = options.position || [0, 2, 0];
  light.position.set(pos[0], pos[1], pos[2]);
  light.castShadow = castShadow;

  if (light.shadow) {
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.bias = -0.002;
  }

  state.scene.add(light);

  const lightSprite = createLightSprite(0xff9900, 0.16);
  lightSprite.position.copy(light.position);
  state.scene.add(lightSprite);

  const helper = new THREE.PointLightHelper(light, 0.2);
  state.scene.add(helper);

  const lightData = {
    id: options.id || "point_light_" + Date.now().toString(36),
    name: options.name || "Point Light",
    type: "point",
    light,
    helper,
    target: null,
    lightSprite,
    targetSprite: null,
    line: null,
    color,
    intensity,
    distance,
    decay,
    castShadow,
  };

  state.lights.push(lightData);
  syncDefaultLightsState();
  if (options.select !== false) {
    selectLight(lightData);
  }
  return lightData;
}

/**
 * Creates a Spot Light in the scene
 */
function createSpotLight(options = {}) {
  const color = options.color || "#ffffff";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 35.0;
  const distance = options.distance !== undefined ? Number(options.distance) : 0;
  const angle = options.angle !== undefined ? Number(options.angle) : Math.PI / 4;
  const penumbra = options.penumbra !== undefined ? Number(options.penumbra) : 0.3;
  const decay = options.decay !== undefined ? Number(options.decay) : 2;
  const castShadow = options.castShadow !== undefined ? Boolean(options.castShadow) : true;

  const light = new THREE.SpotLight(
    new THREE.Color(color),
    intensity,
    distance,
    angle,
    penumbra,
    decay
  );
  const pos = options.position || [0, 3.5, 2];
  light.position.set(pos[0], pos[1], pos[2]);
  light.castShadow = castShadow;

  if (light.shadow) {
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.bias = -0.0005;
  }

  const target = new THREE.Object3D();
  const targetPos = options.target || [0, 0, 0];
  target.position.set(targetPos[0], targetPos[1], targetPos[2]);
  state.scene.add(target);
  light.target = target;

  state.scene.add(light);

  const lightSprite = createLightSprite(0xff5500, 0.16);
  lightSprite.position.copy(light.position);
  state.scene.add(lightSprite);

  const targetSprite = createLightSprite(0x00e5ff, 0.12);
  targetSprite.position.copy(target.position);
  state.scene.add(targetSprite);

  const helper = new THREE.SpotLightHelper(light);
  state.scene.add(helper);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    light.position.clone(),
    target.position.clone(),
  ]);
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  state.scene.add(line);

  const lightData = {
    id: options.id || "spot_light_" + Date.now().toString(36),
    name: options.name || "Spot Light",
    type: "spot",
    light,
    helper,
    target,
    lightSprite,
    targetSprite,
    line,
    color,
    intensity,
    distance,
    angle,
    penumbra,
    decay,
    castShadow,
  };

  state.lights.push(lightData);
  syncDefaultLightsState();
  if (options.select !== false) {
    selectLight(lightData);
  }
  return lightData;
}

/**
 * Creates an Ambient Light in the scene
 */
function createAmbientLight(options = {}) {
  const color = options.color || "#ffffff";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 0.8;

  const light = new THREE.AmbientLight(new THREE.Color(color), intensity);
  state.scene.add(light);

  const lightData = {
    id: options.id || "ambient_light_" + Date.now().toString(36),
    name: options.name || "Ambient Light",
    type: "ambient",
    light,
    helper: null,
    target: null,
    lightSprite: null,
    targetSprite: null,
    line: null,
    color,
    intensity,
    castShadow: false,
  };

  state.lights.push(lightData);
  syncDefaultLightsState();
  if (options.select !== false) {
    selectLight(lightData);
  }
  return lightData;
}

function selectLight(lightData) {
  select("light", lightData);
}

function deselectLight() {
  deselect("light");
}

function deleteLight(lightData) {
  if (!lightData) return;

  if (lightData.light) state.scene.remove(lightData.light);
  if (lightData.lightSprite) state.scene.remove(lightData.lightSprite);
  if (lightData.targetSprite) state.scene.remove(lightData.targetSprite);
  if (lightData.helper) state.scene.remove(lightData.helper);
  if (lightData.line) state.scene.remove(lightData.line);
  if (lightData.target) state.scene.remove(lightData.target);

  const index = state.lights.indexOf(lightData);
  if (index !== -1) {
    state.lights.splice(index, 1);
  }

  if (state.selectedLight === lightData) {
    deselectLight();
  }
  syncDefaultLightsState();
  notifySelectionChanged();
}

function deleteSelectedLight() {
  if (!state.selectedLight) return;
  deleteLight(state.selectedLight);
}

function clearAllLights() {
  const currentLights = [...state.lights];
  currentLights.forEach((l) => {
    if (l.light) state.scene.remove(l.light);
    if (l.lightSprite) state.scene.remove(l.lightSprite);
    if (l.targetSprite) state.scene.remove(l.targetSprite);
    if (l.helper) {
      state.scene.remove(l.helper);
      l.helper.dispose?.();
    }
    if (l.line) state.scene.remove(l.line);
    if (l.target) state.scene.remove(l.target);
  });
  state.lights.length = 0;
  clearSelection();
  syncDefaultLightsState();
}

function syncDefaultLightsState() {
  const hasCustomLights = Array.isArray(state.lights) && state.lights.length > 0;
  if (state.defaultAmbientLight) {
    state.defaultAmbientLight.visible = !hasCustomLights;
  }
  if (state.defaultDirectionalLight) {
    state.defaultDirectionalLight.visible = !hasCustomLights;
  }
}

function updateLights() {
  for (const l of state.lights) {
    if (l.lightSprite && l.light) {
      l.lightSprite.position.copy(l.light.position);
    }
    if (l.targetSprite && l.target) {
      l.targetSprite.position.copy(l.target.position);
    }
    if (l.target) {
      l.target.updateMatrixWorld(true);
    }
    if (l.light) {
      l.light.updateMatrixWorld(true);
    }
    if (l.helper) {
      l.helper.update?.();
    }
    if (l.line && l.light && l.target) {
      const posAttr = l.line.geometry.attributes.position;
      if (posAttr) {
        posAttr.setXYZ(0, l.light.position.x, l.light.position.y, l.light.position.z);
        posAttr.setXYZ(1, l.target.position.x, l.target.position.y, l.target.position.z);
        posAttr.needsUpdate = true;
      } else {
        l.line.geometry.setFromPoints([l.light.position, l.target.position]);
      }
    }
  }
}

/**
 * Apply Lighting Presets (scaled to model bounding box)
 */
function applyLightingPreset(presetKey) {
  clearAllLights();

  // Determine model scale
  let scale = 1.0;
  let center = new THREE.Vector3(0, 0, 0);

  if (state.currentModel) {
    const box = new THREE.Box3().setFromObject(state.currentModel);
    if (!box.isEmpty()) {
      box.getCenter(center);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        scale = Math.max(0.5, maxDim / 2.0);
      }
    }
  }

  const preset = STUDIO_LIGHTING_PRESETS[presetKey] || STUDIO_LIGHTING_PRESETS.clean_studio;
  if (!preset || !preset.lights) return;

  preset.lights.forEach((l) => {
    const pos = Array.isArray(l.position) ? [
      center.x + l.position[0] * scale,
      center.y + l.position[1] * scale,
      center.z + l.position[2] * scale
    ] : [0, 0, 0];

    if (l.type === "DirectionalLight") {
      createDirectionalLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        position: pos,
        target: [center.x, center.y, center.z],
        castShadow: l.castShadow,
        select: false
      });
    } else if (l.type === "PointLight") {
      createPointLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        position: pos,
        distance: l.distance || 0,
        decay: l.decay || 2,
        castShadow: l.castShadow,
        select: false
      });
    } else if (l.type === "SpotLight") {
      createSpotLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        position: pos,
        target: [center.x, center.y, center.z],
        angle: l.angle || Math.PI / 4,
        penumbra: l.penumbra || 0.2,
        castShadow: l.castShadow,
        select: false
      });
    } else if (l.type === "AmbientLight") {
      createAmbientLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        select: false
      });
    }
  });

  if (state.lights.length > 0) {
    selectLight(state.lights[0]);
  } else {
    clearSelection();
  }
}

function bindLightUI() {
  document.getElementById("addDirectionalLightBtn")?.addEventListener("click", () => {
    createDirectionalLight();
  });
  document.getElementById("addPointLightBtn")?.addEventListener("click", () => {
    createPointLight();
  });
  document.getElementById("addSpotLightBtn")?.addEventListener("click", () => {
    createSpotLight();
  });
  document.getElementById("addAmbientLightBtn")?.addEventListener("click", () => {
    createAmbientLight();
  });
  document.getElementById("deleteLightBtn")?.addEventListener("click", () => {
    deleteSelectedLight();
  });
}

export {
  applyLightingPreset,
  bindLightUI,
  clearAllLights,
  createAmbientLight,
  createDirectionalLight,
  createPointLight,
  createSpotLight,
  deleteLight,
  deleteSelectedLight,
  deselectLight,
  selectLight,
  syncDefaultLightsState,
  updateLights
};
