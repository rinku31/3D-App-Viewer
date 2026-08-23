/**
 * Shared 3D Environment, Background & ToneMapping Utilities
 */

import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { disposeTexture } from "./disposal.js";

export const HDR_PRESETS = [
  {
    id: "studio_small_09",
    name: "Balance",
    fullName: "Studio Small 09 (Balance)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr"
  },
  {
    id: "potsdamer_platz",
    name: "Urban",
    fullName: "Potsdamer Platz (Urban)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr"
  },
  {
    id: "autumn_ground",
    name: "Nature",
    fullName: "Autumn Park (Nature)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr"
  },
  {
    id: "aircraft_workshop",
    name: "Industrial",
    fullName: "Aircraft Workshop (Industrial)",
    url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr"
  }
];

export const HDR_PRESET_MAP = {
  studio_small_09: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr",
  potsdamer_platz: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr",
  autumn_ground: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr",
  aircraft_workshop: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr",
  // Aliases
  balance: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr",
  urban: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr",
  nature: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr",
  industrial: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr",
  // Legacy aliases
  sunset_fairway: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_ground_1k.hdr",
  puresky: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr",
  workshop: "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aircraft_workshop_01_1k.hdr"
};

// Global texture cache across instances to enable instantaneous switching
const globalTextureCache = new Map();
const globalLoadingPromises = new Map();

/**
 * Creates an Environment Manager instance for a given scene and renderer
 */
export function createEnvironmentManager({ scene, renderer }) {
  let pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const rgbeLoader = new RGBELoader();

  let currentEnvTexture = null;
  let currentPreset = null;

  /**
   * Preloads all 4 standard HDR environment presets into memory for 0ms instant switching
   */
  function preloadPresets() {
    HDR_PRESETS.forEach((preset) => {
      loadHdrTexture(preset.id);
    });
  }

  /**
   * Internal helper to load and PMREM-convert an HDR texture with caching
   */
  function loadHdrTexture(presetOrUrl) {
    const url = HDR_PRESET_MAP[presetOrUrl] || (HDR_PRESETS.find(p => p.id === presetOrUrl)?.url) || presetOrUrl;
    if (!url) return Promise.reject(new Error("Invalid HDR preset or URL"));

    if (globalTextureCache.has(url)) {
      return Promise.resolve(globalTextureCache.get(url));
    }

    if (globalLoadingPromises.has(url)) {
      return globalLoadingPromises.get(url);
    }

    const loadPromise = new Promise((resolve, reject) => {
      rgbeLoader.load(
        url,
        (hdrTexture) => {
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          const envTexture = pmremGenerator.fromEquirectangular(hdrTexture).texture;
          hdrTexture.dispose();
          globalTextureCache.set(url, envTexture);
          globalLoadingPromises.delete(url);
          resolve(envTexture);
        },
        undefined,
        (err) => {
          console.warn("Could not load HDR environment from:", url, err);
          globalLoadingPromises.delete(url);
          reject(err);
        }
      );
    });

    globalLoadingPromises.set(url, loadPromise);
    return loadPromise;
  }

  function loadEnvironment(presetOrUrl, onLoaded, onError) {
    const url = HDR_PRESET_MAP[presetOrUrl] || (HDR_PRESETS.find(p => p.id === presetOrUrl)?.url) || presetOrUrl;
    if (!url) return;

    currentPreset = presetOrUrl;

    // Fast-path: Instant synchronous swap if already in cache
    if (globalTextureCache.has(url)) {
      const cachedTexture = globalTextureCache.get(url);
      currentEnvTexture = cachedTexture;
      if (scene) {
        scene.environment = cachedTexture;
        // Keep solid background color as is unless scene background is explicitly set to environment skybox
        if (scene.background && scene.background.isTexture) {
          scene.background = cachedTexture;
        }
      }
      if (typeof onLoaded === "function") {
        onLoaded(cachedTexture);
      }
      return;
    }

    // Asynchronous load if not yet cached
    loadHdrTexture(presetOrUrl)
      .then((envTexture) => {
        currentEnvTexture = envTexture;
        if (scene) {
          scene.environment = envTexture;
          if (scene.background && scene.background.isTexture) {
            scene.background = envTexture;
          }
        }
        if (typeof onLoaded === "function") {
          onLoaded(envTexture);
        }
      })
      .catch((err) => {
        if (typeof onError === "function") {
          onError(err);
        }
      });
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
    if (pmremGenerator) {
      pmremGenerator.dispose();
      pmremGenerator = null;
    }
  }

  return {
    loadEnvironment,
    preloadPresets,
    applyBackground,
    applyToneMapping,
    getEnvTexture: () => currentEnvTexture,
    getCurrentPreset: () => currentPreset,
    dispose
  };
}
