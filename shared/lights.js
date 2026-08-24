/**
 * Shared Lighting Utilities for Three.js
 */

import * as THREE from "three";
import { disposeHierarchy } from "./disposal.js";

/**
 * Curated Studio Lighting Presets
 */
export const STUDIO_LIGHTING_PRESETS = {
  clean_studio: {
    id: "clean_studio",
    name: "Clean Studio (Default)",
    description: "Balanced 3-point studio lighting with high key, soft cool fill, and subtle rim highlight.",
    lights: [
      {
        id: "key_light",
        type: "DirectionalLight",
        name: "Key Light",
        color: "#ffffff",
        intensity: 2.2,
        position: [3.5, 4.0, 3.5],
        castShadow: true
      },
      {
        id: "fill_light",
        type: "DirectionalLight",
        name: "Fill Light",
        color: "#d9e8ff",
        intensity: 1.0,
        position: [-4.0, 2.0, 2.5],
        castShadow: false
      },
      {
        id: "rim_light",
        type: "DirectionalLight",
        name: "Rim / Back Light",
        color: "#ffffff",
        intensity: 1.5,
        position: [0.0, 4.5, -4.0],
        castShadow: false
      },
      {
        id: "ambient_light",
        type: "AmbientLight",
        name: "Ambient",
        color: "#ffffff",
        intensity: 0.35,
        position: [0, 0, 0],
        castShadow: false
      }
    ]
  },
  dramatic_contrast: {
    id: "dramatic_contrast",
    name: "Dramatic Contrast",
    description: "Strong directional key with high shadow contrast and a warm rim edge.",
    lights: [
      {
        id: "key_light",
        type: "DirectionalLight",
        name: "Hard Key",
        color: "#fff8ee",
        intensity: 3.2,
        position: [4.5, 3.0, 3.0],
        castShadow: true
      },
      {
        id: "fill_light",
        type: "DirectionalLight",
        name: "Subtle Fill",
        color: "#9db4d4",
        intensity: 0.4,
        position: [-4.0, 1.5, 2.0],
        castShadow: false
      },
      {
        id: "rim_light",
        type: "DirectionalLight",
        name: "Warm Rim Light",
        color: "#ffd4a3",
        intensity: 2.4,
        position: [-1.5, 3.5, -4.5],
        castShadow: false
      },
      {
        id: "ambient_light",
        type: "AmbientLight",
        name: "Ambient",
        color: "#ffffff",
        intensity: 0.15,
        position: [0, 0, 0],
        castShadow: false
      }
    ]
  },
  dark_showcase: {
    id: "dark_showcase",
    name: "Dark Showcase",
    description: "Low ambient setup with dual rim and top highlights, ideal for dark backgrounds.",
    lights: [
      {
        id: "top_light",
        type: "DirectionalLight",
        name: "Top Down Key",
        color: "#ffffff",
        intensity: 2.5,
        position: [0.0, 6.0, 1.0],
        castShadow: true
      },
      {
        id: "left_rim",
        type: "DirectionalLight",
        name: "Left Rim",
        color: "#6ee7b7",
        intensity: 1.8,
        position: [-4.5, 2.5, -3.0],
        castShadow: false
      },
      {
        id: "right_rim",
        type: "DirectionalLight",
        name: "Right Rim",
        color: "#93c5fd",
        intensity: 1.8,
        position: [4.5, 2.5, -3.0],
        castShadow: false
      },
      {
        id: "ambient_light",
        type: "AmbientLight",
        name: "Subtle Ambient",
        color: "#ffffff",
        intensity: 0.1,
        position: [0, 0, 0],
        castShadow: false
      }
    ]
  },
  outdoor_sun: {
    id: "outdoor_sun",
    name: "Outdoor / Neutral Sun",
    description: "Simulates crisp outdoor direct sunlight with warm highlights and sky fill.",
    lights: [
      {
        id: "sun_light",
        type: "DirectionalLight",
        name: "Sunlight",
        color: "#fffdf0",
        intensity: 2.8,
        position: [5.0, 7.0, 3.5],
        castShadow: true
      },
      {
        id: "sky_fill",
        type: "DirectionalLight",
        name: "Sky Fill",
        color: "#cbe3ff",
        intensity: 1.2,
        position: [-4.0, 5.0, -2.0],
        castShadow: false
      },
      {
        id: "ground_bounce",
        type: "AmbientLight",
        name: "Ground Bounce Ambient",
        color: "#f5f3e9",
        intensity: 0.45,
        position: [0, 0, 0],
        castShadow: false
      }
    ]
  }
};

/**
 * Creates a Three.js Light object from a Schema v2 light definition
 * @param {object} lightData 
 * @returns {THREE.Light}
 */
export function createLightFromData(lightData) {
  const color = new THREE.Color(lightData.color || "#ffffff");
  const intensity = Number(lightData.intensity ?? 1.0);
  const rawType = (lightData.type || "directional").toLowerCase();

  let light = null;

  switch (rawType) {
    case "ambient":
    case "ambientlight":
      light = new THREE.AmbientLight(color, intensity);
      break;

    case "point":
    case "pointlight":
      light = new THREE.PointLight(
        color,
        intensity,
        Number(lightData.distance || 0),
        Number(lightData.decay ?? 2)
      );
      if (Array.isArray(lightData.position)) {
        light.position.set(...lightData.position);
      }
      light.castShadow = Boolean(lightData.castShadow);
      if (light.castShadow) {
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        light.shadow.bias = -0.0005;
      }
      break;

    case "spot":
    case "spotlight":
      light = new THREE.SpotLight(
        color,
        intensity,
        Number(lightData.distance || 0),
        Number(lightData.angle || Math.PI / 4),
        Number(lightData.penumbra || 0.3),
        Number(lightData.decay ?? 2)
      );
      if (Array.isArray(lightData.position)) {
        light.position.set(...lightData.position);
      }
      if (Array.isArray(lightData.target)) {
        light.target.position.set(...lightData.target);
      }
      light.castShadow = Boolean(lightData.castShadow);
      if (light.castShadow) {
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        light.shadow.bias = -0.0005;
      }
      break;

    case "area":
    case "arealight":
    case "rectarea":
    case "rectarealight":
      light = new THREE.RectAreaLight(
        color,
        intensity,
        Number(lightData.width || 2.5),
        Number(lightData.height || 2.5)
      );
      if (Array.isArray(lightData.position)) {
        light.position.set(...lightData.position);
      }
      if (Array.isArray(lightData.target)) {
        light.lookAt(new THREE.Vector3(...lightData.target));
      }
      break;

    case "directional":
    case "directionallight":
    default:
      light = new THREE.DirectionalLight(color, intensity);
      if (Array.isArray(lightData.position)) {
        light.position.set(...lightData.position);
      }
      if (Array.isArray(lightData.target)) {
        light.target.position.set(...lightData.target);
      }
      light.castShadow = Boolean(lightData.castShadow);
      if (light.castShadow) {
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 40;
        light.shadow.bias = -0.0005;
      }
      break;
  }

  light.name = lightData.name || `${rawType} light`;
  light.userData = { id: lightData.id, schemaData: lightData };

  return light;
}

/**
 * Replaces scene custom lights with a list of Schema v2 lights
 */
export function syncSceneLights(scene, lightsData, activeCustomLights = []) {
  // Clear old lights
  activeCustomLights.forEach((l) => {
    if (l.target && l.target.parent) {
      l.target.parent.remove(l.target);
    }
    disposeHierarchy(l, true);
  });
  activeCustomLights.length = 0;

  if (!Array.isArray(lightsData)) return activeCustomLights;

  lightsData.forEach((lData) => {
    const light = createLightFromData(lData);
    if (light) {
      scene.add(light);
      if (light.target) {
        scene.add(light.target);
        light.target.updateMatrixWorld(true);
      }
      light.updateMatrixWorld(true);
      activeCustomLights.push(light);
    }
  });

  return activeCustomLights;
}

/**
 * Applies a studio lighting preset to a scene and scales light positions relative to a model box.
 */
export function applyStudioPreset(scene, presetKey = "clean_studio", modelObject = null) {
  const preset = STUDIO_LIGHTING_PRESETS[presetKey] || STUDIO_LIGHTING_PRESETS.clean_studio;
  if (!preset || !preset.lights) return [];

  let scale = 1.0;
  let center = new THREE.Vector3(0, 0, 0);

  if (modelObject) {
    const box = new THREE.Box3().setFromObject(modelObject);
    if (!box.isEmpty()) {
      box.getCenter(center);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        scale = Math.max(0.5, maxDim / 2.0);
      }
    }
  }

  const scaledLights = preset.lights.map((l) => {
    const copy = JSON.parse(JSON.stringify(l));
    if (Array.isArray(copy.position) && l.type !== "AmbientLight") {
      copy.position = [
        center.x + copy.position[0] * scale,
        center.y + copy.position[1] * scale,
        center.z + copy.position[2] * scale
      ];
    }
    return copy;
  });

  return scaledLights;
}
