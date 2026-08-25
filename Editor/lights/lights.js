import * as THREE from "three";
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";

import { clearSelection, state, notifySelectionChanged } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";

import { STUDIO_LIGHTING_PRESETS } from "../../shared/lights.js";

const lightTexture = new THREE.TextureLoader().load(
  "https://threejs.org/examples/textures/sprites/disc.png"
);

/**
 * Converts Kelvin color temperature (1000K - 12000K) to hex color string
 */
export function kelvinToHex(kelvin) {
  const temp = Math.max(1000, Math.min(12000, Number(kelvin))) / 100;
  let red, green, blue;

  // Red
  if (temp <= 66) {
    red = 255;
  } else {
    red = temp - 60;
    red = 329.698727446 * Math.pow(red, -0.1332047592);
    red = Math.min(255, Math.max(0, red));
  }

  // Green
  if (temp <= 66) {
    green = temp;
    green = 99.4708025861 * Math.log(green) - 161.1195681661;
    green = Math.min(255, Math.max(0, green));
  } else {
    green = temp - 60;
    green = 288.1221695283 * Math.pow(green, -0.0755148492);
    green = Math.min(255, Math.max(0, green));
  }

  // Blue
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = temp - 10;
    blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    blue = Math.min(255, Math.max(0, blue));
  }

  const r = Math.round(red).toString(16).padStart(2, "0");
  const g = Math.round(green).toString(16).padStart(2, "0");
  const b = Math.round(blue).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export const KELVIN_PRESETS = [
  { name: "Warm Tungsten (2700K)", kelvin: 2700, color: kelvinToHex(2700) },
  { name: "Studio Halogen (3200K)", kelvin: 3200, color: kelvinToHex(3200) },
  { name: "Fluorescent (4000K)", kelvin: 4000, color: kelvinToHex(4000) },
  { name: "Direct Sunlight (5500K)", kelvin: 5500, color: kelvinToHex(5500) },
  { name: "Daylight D65 (6500K)", kelvin: 6500, color: kelvinToHex(6500) },
  { name: "Overcast Sky (7500K)", kelvin: 7500, color: kelvinToHex(7500) },
];

export const CYCLES_LIGHTING_PRESETS = {
  cycles_studio: {
    id: "cycles_studio",
    name: "Blender Cycles Studio (3-Point)",
    description: "Soft warm key sun with cool area fill and crisp rim edge, matching Cycles studio renders.",
    lights: [
      {
        name: "Key Sun Light",
        type: "directional",
        color: kelvinToHex(5500),
        intensity: 3.5,
        position: [3.2, 4.2, 3.2],
        target: [0, 0, 0],
        castShadow: true,
        radius: 2.0,
      },
      {
        name: "Fill Softbox Area",
        type: "area",
        color: kelvinToHex(6500),
        intensity: 12.0,
        width: 3.0,
        height: 3.0,
        position: [-3.5, 2.5, 2.2],
        target: [0, 0, 0],
      },
      {
        name: "Rim Backlight",
        type: "directional",
        color: "#ffffff",
        intensity: 2.8,
        position: [0.0, 3.8, -4.0],
        target: [0, 0, 0],
        castShadow: false,
      }
    ]
  },
  cycles_product: {
    id: "cycles_product",
    name: "Cycles Product Showcase",
    description: "Top overhead softbox with high-contrast dual edge kickers for crisp product definition.",
    lights: [
      {
        name: "Overhead Top Softbox",
        type: "area",
        color: "#ffffff",
        intensity: 18.0,
        width: 4.0,
        height: 4.0,
        position: [0.0, 5.0, 0.5],
        target: [0, 0, 0],
      },
      {
        name: "Left Kicker Spot",
        type: "spot",
        color: kelvinToHex(6000),
        intensity: 35.0,
        position: [-4.0, 2.0, -2.5],
        target: [0, 0, 0],
        angle: Math.PI / 4,
        penumbra: 0.5,
        castShadow: true,
        radius: 2.5,
      },
      {
        name: "Right Kicker Spot",
        type: "spot",
        color: kelvinToHex(5000),
        intensity: 35.0,
        position: [4.0, 2.0, -2.5],
        target: [0, 0, 0],
        angle: Math.PI / 4,
        penumbra: 0.5,
        castShadow: true,
        radius: 2.5,
      }
    ]
  },
  cycles_sun: {
    id: "cycles_sun",
    name: "Cycles Outdoor Sun",
    description: "High-power crisp directional sun at 5500K with deep contact ground shadows.",
    lights: [
      {
        name: "Direct Sunlight",
        type: "directional",
        color: kelvinToHex(5500),
        intensity: 4.5,
        position: [4.5, 6.5, 3.0],
        target: [0, 0, 0],
        castShadow: true,
        radius: 1.5,
      },
      {
        name: "Sky Ambient Bounce",
        type: "ambient",
        color: kelvinToHex(7500),
        intensity: 0.35,
      }
    ]
  },
  cycles_moody: {
    id: "cycles_moody",
    name: "Cycles Cinematic Moody",
    description: "Dramatic low-key rim lighting with warm tungsten accent and sharp edge falloff.",
    lights: [
      {
        name: "Warm Rim Point",
        type: "point",
        color: kelvinToHex(2700),
        intensity: 45.0,
        position: [-2.5, 3.0, -3.0],
        castShadow: true,
        radius: 3.0,
      },
      {
        name: "Cool Side Softbox",
        type: "area",
        color: kelvinToHex(7500),
        intensity: 14.0,
        width: 3.0,
        height: 3.0,
        position: [3.5, 1.8, 2.0],
        target: [0, 0, 0],
      }
    ]
  }
};

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
 * Creates a Directional / Sun Light in the scene (Blender Sun Light model)
 */
function createDirectionalLight(options = {}) {
  const color = options.color || "#ffffff";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 3.5;
  const castShadow = options.castShadow !== undefined ? Boolean(options.castShadow) : true;
  const radius = options.radius !== undefined ? Number(options.radius) : 2.0;

  const light = new THREE.DirectionalLight(new THREE.Color(color), intensity);
  const pos = options.position || [2.5, 4.0, 2.5];
  light.position.set(pos[0], pos[1], pos[2]);
  light.castShadow = castShadow;

  if (light.shadow) {
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 40;
    light.shadow.bias = -0.0001;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = radius;
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
    name: options.name || "Sun Light",
    type: "directional",
    light,
    helper,
    target,
    lightSprite,
    targetSprite,
    line,
    color,
    intensity,
    radius,
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
 * Creates a Point Light in the scene (Blender Point Light model with inverse-square falloff)
 */
function createPointLight(options = {}) {
  const color = options.color || "#ffaa33";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 30.0;
  const distance = options.distance !== undefined ? Number(options.distance) : 0;
  const decay = options.decay !== undefined ? Number(options.decay) : 2.0; // Inverse square
  const castShadow = options.castShadow !== undefined ? Boolean(options.castShadow) : true;
  const radius = options.radius !== undefined ? Number(options.radius) : 2.0;

  const light = new THREE.PointLight(new THREE.Color(color), intensity, distance, decay);
  const pos = options.position || [0, 2.5, 0];
  light.position.set(pos[0], pos[1], pos[2]);
  light.castShadow = castShadow;

  if (light.shadow) {
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = radius;
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
    radius,
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
 * Creates a Spot Light in the scene (Blender Spot Light model with Spot Size & Blend)
 */
function createSpotLight(options = {}) {
  const color = options.color || "#ffffff";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 40.0;
  const distance = options.distance !== undefined ? Number(options.distance) : 0;
  const angle = options.angle !== undefined ? Number(options.angle) : Math.PI / 4;
  const penumbra = options.penumbra !== undefined ? Number(options.penumbra) : 0.4;
  const decay = options.decay !== undefined ? Number(options.decay) : 2.0;
  const castShadow = options.castShadow !== undefined ? Boolean(options.castShadow) : true;
  const radius = options.radius !== undefined ? Number(options.radius) : 2.0;

  const light = new THREE.SpotLight(
    new THREE.Color(color),
    intensity,
    distance,
    angle,
    penumbra,
    decay
  );
  const pos = options.position || [0, 3.5, 2.5];
  light.position.set(pos[0], pos[1], pos[2]);
  light.castShadow = castShadow;

  if (light.shadow) {
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.bias = -0.0001;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = radius;
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
    radius,
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
 * Creates an Area / Softbox Light in the scene (Blender Area Light model)
 */
function createAreaLight(options = {}) {
  const color = options.color || "#ffffff";
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 15.0;
  const width = options.width !== undefined ? Number(options.width) : (options.light?.width !== undefined ? Number(options.light.width) : 2.5);
  const height = options.height !== undefined ? Number(options.height) : (options.light?.height !== undefined ? Number(options.light.height) : 2.5);

  const light = new THREE.RectAreaLight(new THREE.Color(color), intensity, width, height);
  const pos = Array.isArray(options.position) 
    ? options.position 
    : (options.position && typeof options.position === "object" ? [options.position.x || 0, options.position.y || 0, options.position.z || 0] : [-2.5, 3.0, 2.5]);
  light.position.set(pos[0], pos[1], pos[2]);

  const target = new THREE.Object3D();
  const targetPos = Array.isArray(options.target) 
    ? options.target 
    : (options.target && typeof options.target === "object" ? [options.target.x || 0, options.target.y || 0, options.target.z || 0] : [0, 0, 0]);
  target.position.set(targetPos[0], targetPos[1], targetPos[2]);
  state.scene.add(target);
  light.lookAt(target.position);

  state.scene.add(light);

  const lightSprite = createLightSprite(0x38bdf8, 0.16);
  lightSprite.position.copy(light.position);
  state.scene.add(lightSprite);

  const targetSprite = createLightSprite(0x00e5ff, 0.12);
  targetSprite.position.copy(target.position);
  state.scene.add(targetSprite);

  let helper = null;
  try {
    helper = new RectAreaLightHelper(light);
    light.add(helper);
  } catch (e) {
    console.warn("Could not create RectAreaLightHelper:", e);
  }

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    light.position.clone(),
    target.position.clone(),
  ]);
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
  );
  state.scene.add(line);

  const lightData = {
    id: options.id || "area_light_" + Date.now().toString(36),
    name: options.name || "Area Softbox",
    type: "area",
    light,
    helper,
    target,
    lightSprite,
    targetSprite,
    line,
    color,
    intensity,
    width,
    height,
    castShadow: false,
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
  const intensity = options.intensity !== undefined ? Number(options.intensity) : 0.4;

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

  if (lightData.light) {
    if (lightData.helper && lightData.light.children.includes(lightData.helper)) {
      lightData.light.remove(lightData.helper);
    }
    state.scene.remove(lightData.light);
  }
  if (lightData.lightSprite) state.scene.remove(lightData.lightSprite);
  if (lightData.targetSprite) state.scene.remove(lightData.targetSprite);
  if (lightData.helper && !lightData.light?.children.includes(lightData.helper)) {
    state.scene.remove(lightData.helper);
  }
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
    if (l.light) {
      if (l.helper && l.light.children.includes(l.helper)) {
        l.light.remove(l.helper);
      }
      state.scene.remove(l.light);
    }
    if (l.lightSprite) state.scene.remove(l.lightSprite);
    if (l.targetSprite) state.scene.remove(l.targetSprite);
    if (l.helper && !l.light?.children.includes(l.helper)) {
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
      if (l.type === "area" && l.target) {
        l.light.lookAt(l.target.position);
      }
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

  const preset = CYCLES_LIGHTING_PRESETS[presetKey] || 
                 STUDIO_LIGHTING_PRESETS[presetKey] || 
                 CYCLES_LIGHTING_PRESETS.cycles_studio;

  if (!preset || !preset.lights) return;

  preset.lights.forEach((l) => {
    const pos = Array.isArray(l.position) ? [
      center.x + l.position[0] * scale,
      center.y + l.position[1] * scale,
      center.z + l.position[2] * scale
    ] : [0, 0, 0];

    const typeLower = (l.type || "directional").toLowerCase();

    if (typeLower === "directionallight" || typeLower === "directional") {
      createDirectionalLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        position: pos,
        target: [center.x, center.y, center.z],
        radius: l.radius || 2.0,
        castShadow: l.castShadow !== false,
        select: false
      });
    } else if (typeLower === "pointlight" || typeLower === "point") {
      createPointLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        position: pos,
        distance: l.distance || 0,
        decay: l.decay || 2.0,
        radius: l.radius || 2.0,
        castShadow: l.castShadow !== false,
        select: false
      });
    } else if (typeLower === "spotlight" || typeLower === "spot") {
      createSpotLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        position: pos,
        target: [center.x, center.y, center.z],
        angle: l.angle || Math.PI / 4,
        penumbra: l.penumbra || 0.3,
        radius: l.radius || 2.0,
        castShadow: l.castShadow !== false,
        select: false
      });
    } else if (typeLower === "arealight" || typeLower === "area" || typeLower === "rectarea") {
      createAreaLight({
        name: l.name,
        color: l.color,
        intensity: l.intensity,
        width: (l.width || 2.5) * scale,
        height: (l.height || 2.5) * scale,
        position: pos,
        target: [center.x, center.y, center.z],
        select: false
      });
    } else if (typeLower === "ambientlight" || typeLower === "ambient") {
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
  document.getElementById("addAreaLightBtn")?.addEventListener("click", () => {
    createAreaLight();
  });
  document.getElementById("addAmbientLightBtn")?.addEventListener("click", () => {
    createAmbientLight();
  });
  document.getElementById("deleteLightBtn")?.addEventListener("click", () => {
    deleteSelectedLight();
  });
}

export function setLightVisibility(lightData, visible) {
  lightData.visible = visible;
  if (lightData.light) lightData.light.visible = visible;
  if (lightData.helper) lightData.helper.visible = visible;
  if (lightData.lightSprite) lightData.lightSprite.visible = visible;
  if (lightData.targetSprite) lightData.targetSprite.visible = visible;
  if (lightData.line) lightData.line.visible = visible;
}

export {
  applyLightingPreset,
  bindLightUI,
  clearAllLights,
  createAmbientLight,
  createAreaLight,
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
