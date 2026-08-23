/**
 * Shared 3D Environment, Background & ToneMapping Utilities
 */

import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { disposeTexture } from "./disposal.js";

export const HDR_PRESETS = [
  {
    id: "studio_small_09",
    name: "Studio Small 09 (Balanced)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr"
  },
  {
    id: "potsdamer_platz",
    name: "Potsdamer Platz (Urban)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr"
  },
  {
    id: "autumn_ground",
    name: "Autumn Park (Warm Nature)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr"
  },
  {
    id: "aircraft_workshop",
    name: "Aircraft Workshop (Industrial)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr"
  }
];

export const HDR_PRESET_MAP = {
  studio_small_09: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr",
  potsdamer_platz: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr",
  autumn_ground: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr",
  aircraft_workshop: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr",
  // Legacy aliases
  sunset_fairway: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr",
  puresky: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr",
  workshop: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr"
};

/**
 * Creates an Environment Manager instance for a given scene and renderer
 */
export function createEnvironmentManager({ scene, renderer }) {
  let pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const rgbeLoader = new RGBELoader();

  let currentEnvTexture = null;
  let currentPreset = null;

  function loadEnvironment(presetOrUrl, onLoaded, onError) {
    const url = HDR_PRESET_MAP[presetOrUrl] || (HDR_PRESETS.find(p => p.id === presetOrUrl)?.url) || presetOrUrl;
    if (!url) return;

    currentPreset = presetOrUrl;

    rgbeLoader.load(
      url,
      (hdrTexture) => {
        if (currentEnvTexture) {
          disposeTexture(currentEnvTexture);
        }
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        currentEnvTexture = pmremGenerator.fromEquirectangular(hdrTexture).texture;
        hdrTexture.dispose();

        scene.environment = currentEnvTexture;

        if (typeof onLoaded === "function") {
          onLoaded(currentEnvTexture);
        }
      },
      undefined,
      (err) => {
        console.warn("Could not load HDR environment from:", url, err);
        if (typeof onError === "function") {
          onError(err);
        }
      }
    );
  }

  function applyBackground(sceneConfig) {
    if (!scene) return;

    const bgType = sceneConfig?.backgroundType || "color";
    const bgColor = sceneConfig?.background || "#222228";
    const blur = Number(sceneConfig?.backgroundBlur || 0);

    if (bgType === "transparent") {
      scene.background = null;
      if (renderer) renderer.setClearColor(0x000000, 0);
    } else if (bgType === "environment") {
      scene.background = currentEnvTexture || new THREE.Color(bgColor);
      if ("backgroundBlurriness" in scene) {
        scene.backgroundBlurriness = blur;
      }
    } else {
      scene.background = new THREE.Color(bgColor);
      if ("backgroundBlurriness" in scene) {
        scene.backgroundBlurriness = 0;
      }
    }
  }

  function applyToneMapping(envConfig) {
    if (!renderer) return;

    const exposure = envConfig?.exposure !== undefined ? Number(envConfig.exposure) : 1.6;
    const toneMappingStr = envConfig?.toneMapping || "ACESFilmic";
    const rotationDeg = envConfig?.rotation !== undefined ? Number(envConfig.rotation) : 0.0;
    const rotationRad = THREE.MathUtils.degToRad(rotationDeg);

    renderer.toneMappingExposure = exposure;

    switch (toneMappingStr) {
      case "AgX":
        renderer.toneMapping = THREE.AgXToneMapping || THREE.ACESFilmicToneMapping;
        break;
      case "Cineon":
        renderer.toneMapping = THREE.CineonToneMapping;
        break;
      case "Reinhard":
        renderer.toneMapping = THREE.ReinhardToneMapping;
        break;
      case "Linear":
        renderer.toneMapping = THREE.LinearToneMapping;
        break;
      case "None":
        renderer.toneMapping = THREE.NoToneMapping;
        break;
      case "ACESFilmic":
      default:
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        break;
    }

    if (scene) {
      if (envConfig?.intensity !== undefined && "environmentIntensity" in scene) {
        scene.environmentIntensity = Number(envConfig.intensity);
      }
      if ("environmentRotation" in scene) {
        scene.environmentRotation.y = rotationRad;
      }
      if ("backgroundRotation" in scene) {
        scene.backgroundRotation.y = rotationRad;
      }
    }
  }

  function dispose() {
    if (currentEnvTexture) {
      disposeTexture(currentEnvTexture);
      currentEnvTexture = null;
    }
    if (pmremGenerator) {
      pmremGenerator.dispose();
      pmremGenerator = null;
    }
  }

  return {
    loadEnvironment,
    applyBackground,
    applyToneMapping,
    getEnvTexture: () => currentEnvTexture,
    getCurrentPreset: () => currentPreset,
    dispose
  };
}
