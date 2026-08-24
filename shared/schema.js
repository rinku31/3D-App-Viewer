/**
 * Scene Schema v2 Definition & Validator & Migrator (Shared)
 * 
 * Standard specification for 3D App Viewer / Editor scene documents.
 * Single source of truth for Schema v2.0.0.
 */

export const CURRENT_SCHEMA_VERSION = "2.0.0";
export const SUPPORTED_SCHEMA_VERSIONS = ["1.0.0", "1.1.0", "2.0.0"];

/**
 * Normalizes and sanitizes asset URLs for cross-browser safety (Firefox, Chrome, Safari, Edge).
 * Corrects unencoded whitespace, special characters, and handles both absolute URLs and relative paths.
 * @param {string} url - Raw URL string
 * @returns {string} Safe normalized URL
 */
export function sanitizeAssetUrl(url) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;

  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      const parsed = new URL(trimmed);
      return parsed.href;
    }
    return encodeURI(decodeURI(trimmed));
  } catch (_) {
    try {
      return encodeURI(decodeURI(trimmed));
    } catch (_) {
      return encodeURI(trimmed);
    }
  }
}

/**
 * Creates default scene document v2
 */
export function createDefaultSceneDocument(modelName = "Product Model") {
  return {
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      title: `${modelName} Scene`,
      author: "3D App Author",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generator: "3D App Viewer Editor v2.0.0",
      tags: ["product", "3d", "interactive"]
    },
    scene: {
      background: "#222228",
      backgroundType: "color",
      backgroundBlur: 0.0,
      environment: {
        preset: "studio_small_09",
        customHdrUrl: null,
        intensity: 1.5,
        rotation: 0.0,
        exposure: 1.6,
        toneMapping: "ACESFilmic"
      },
      rendering: {
        shadows: true,
        shadowType: "pcfsoft",
        bloom: {
          enabled: false,
          strength: 0.6,
          radius: 0.4,
          threshold: 0.85
        }
      },
      bloom: {
        enabled: false,
        strength: 0.6,
        radius: 0.4,
        threshold: 0.85
      },
      helpers: {
        grid: true,
        axes: false
      }
    },
    camera: {
      fov: 45,
      near: 0.01,
      far: 1000,
      target: [0, 0, 0],
      position: [0, 1.2, 4.0],
      distance: 4.0,
      minDistance: 1.35,
      maxDistance: 16.0,
      yaw: 0.0,
      pitch: 0.2
    },
    model: {
      name: modelName,
      filename: `${modelName}.glb`,
      position: [0, 0, 0],
      rotation: { x: 0, y: 0, z: 0 },
      scale: [1, 1, 1]
    },
    lights: [
      {
        id: "dir_light_key",
        name: "Main Key Light",
        type: "directional",
        color: "#ffffff",
        intensity: 2.2,
        castShadow: true,
        position: [4, 8, 4],
        target: [0, 0, 0]
      },
      {
        id: "dir_light_fill",
        name: "Fill Light",
        type: "directional",
        color: "#90c8ff",
        intensity: 1.0,
        castShadow: false,
        position: [-4, 3, -3],
        target: [0, 0, 0]
      }
    ],
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
    hotspots: []
  };
}

/**
 * Validates a JSON document against Scene Schema v2.
 * Returns an object: { valid: boolean, errors: string[], warnings: string[], version: string }
 */
export function validateSceneDocument(raw) {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      version: "unknown",
      errors: ["Document must be a valid JSON object."],
      warnings
    };
  }

  let version = raw.version || raw.schemaVersion || "1.0.0";
  if (typeof version !== "string") {
    warnings.push("Version property is not a string; assuming '1.0.0'.");
    version = "1.0.0";
  }

  if (!raw.hotspots) {
    errors.push("Missing required field 'hotspots'.");
  } else if (!Array.isArray(raw.hotspots)) {
    errors.push("Field 'hotspots' must be an array.");
  } else {
    raw.hotspots.forEach((h, index) => {
      if (!h || typeof h !== "object") {
        errors.push(`hotspots[${index}] must be an object.`);
        return;
      }
      if (!Array.isArray(h.position) || h.position.length !== 3) {
        errors.push(`hotspots[${index}].position must be an array of 3 numbers [x, y, z].`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    version,
    errors,
    warnings
  };
}

/**
 * Migrates any scene document (v1.0.0, v1.1.0, or untyped) to Schema v2.0.0
 */
export function migrateSceneDocument(raw, defaultModelName = "Product Model") {
  if (!raw || typeof raw !== "object") {
    return createDefaultSceneDocument(defaultModelName);
  }

  const base = createDefaultSceneDocument(defaultModelName);

  const metadata = {
    ...base.metadata,
    ...(raw.metadata || {}),
    updatedAt: new Date().toISOString(),
    migratedFrom: raw.version || "1.0.0"
  };

  const scene = {
    ...base.scene,
    ...(raw.scene || {})
  };

  if (raw.scene?.environment) {
    const rawEnv = raw.scene.environment;
    scene.environment = {
      ...base.scene.environment,
      preset: rawEnv.preset || rawEnv.hdri || base.scene.environment.preset,
      intensity: typeof rawEnv.intensity === "number" ? rawEnv.intensity : base.scene.environment.intensity,
      exposure: typeof rawEnv.exposure === "number" ? rawEnv.exposure : base.scene.environment.exposure,
      toneMapping: rawEnv.toneMapping || base.scene.environment.toneMapping,
      rotation: typeof rawEnv.rotation === "number" ? rawEnv.rotation : 0.0
    };
  }

  const rawBloom = raw.scene?.rendering?.bloom || raw.scene?.bloom || raw.bloom;
  if (rawBloom && typeof rawBloom === "object") {
    const bloomObj = {
      enabled: Boolean(rawBloom.enabled),
      strength: typeof rawBloom.strength === "number" ? rawBloom.strength : 0.6,
      radius: typeof rawBloom.radius === "number" ? rawBloom.radius : 0.4,
      threshold: typeof rawBloom.threshold === "number" ? rawBloom.threshold : 0.85,
    };
    if (!scene.rendering) scene.rendering = {};
    scene.rendering.bloom = bloomObj;
    scene.bloom = bloomObj;
  }

  const camera = {
    ...base.camera,
    ...(raw.camera || {})
  };
  if (typeof raw.camera?.minDistance === "number") {
    camera.minDistance = Math.max(0.01, raw.camera.minDistance);
  }
  if (typeof raw.camera?.maxDistance === "number") {
    camera.maxDistance = Math.max((camera.minDistance || 0.1) + 0.05, raw.camera.maxDistance);
  }
  delete camera.viewpoints;

  const model = {
    ...base.model,
    ...(raw.model || {})
  };
  if (raw.model?.rotation && typeof raw.model.rotation === "object") {
    model.rotation = {
      x: Number(raw.model.rotation.x) || 0,
      y: Number(raw.model.rotation.y) || 0,
      z: Number(raw.model.rotation.z) || 0
    };
  }

  let lights = [];
  if (Array.isArray(raw.lights) && raw.lights.length > 0) {
    lights = raw.lights.map((l, idx) => {
      const rawType = String(l.type || "directional").toLowerCase();
      let type = "directional";
      if (rawType.includes("point")) type = "point";
      else if (rawType.includes("spot")) type = "spot";
      else if (rawType.includes("area") || rawType.includes("rect")) type = "area";
      else if (rawType.includes("ambient")) type = "ambient";

      const defaultName = type === "area" ? "Area Softbox" : `${type.charAt(0).toUpperCase() + type.slice(1)} Light`;
      const lightEntry = {
        id: l.id || `light_${idx + 1}_${Date.now().toString(36)}`,
        name: l.name || defaultName,
        type,
        color: l.color || "#ffffff",
        intensity: typeof l.intensity === "number" ? l.intensity : (type === "area" ? 15.0 : 2.0),
        castShadow: l.castShadow !== undefined ? Boolean(l.castShadow) : (type !== "ambient" && type !== "area"),
      };

      if (Array.isArray(l.position) && l.position.length === 3) {
        lightEntry.position = [Number(l.position[0]), Number(l.position[1]), Number(l.position[2])];
      } else if (l.position && typeof l.position === "object") {
        lightEntry.position = [Number(l.position.x) || 0, Number(l.position.y) || 0, Number(l.position.z) || 0];
      }

      if (Array.isArray(l.target) && l.target.length === 3) {
        lightEntry.target = [Number(l.target[0]), Number(l.target[1]), Number(l.target[2])];
      } else if (l.target && typeof l.target === "object") {
        lightEntry.target = [Number(l.target.x) || 0, Number(l.target.y) || 0, Number(l.target.z) || 0];
      }

      if (typeof l.distance === "number") lightEntry.distance = l.distance;
      if (typeof l.decay === "number") lightEntry.decay = l.decay;
      if (typeof l.angle === "number") lightEntry.angle = l.angle;
      if (typeof l.penumbra === "number") lightEntry.penumbra = l.penumbra;
      if (typeof l.width === "number") lightEntry.width = l.width;
      else if (type === "area") lightEntry.width = 2.5;

      if (typeof l.height === "number") lightEntry.height = l.height;
      else if (type === "area") lightEntry.height = 2.5;

      if (typeof l.radius === "number") lightEntry.radius = l.radius;

      return lightEntry;
    });
  } else {
    lights = base.lights;
  }

  const settings = {
    line: {
      color: raw.settings?.line?.color || base.settings.line.color,
      width: typeof raw.settings?.line?.width === "number" ? raw.settings.line.width : base.settings.line.width,
      offset: {
        x: Number(raw.settings?.line?.offset?.x) || 0,
        y: Number(raw.settings?.line?.offset?.y) || 0
      }
    },
    hotspots: {
      ...base.settings.hotspots,
      ...(raw.settings?.hotspots || {})
    }
  };

  let hotspots = [];
  if (Array.isArray(raw.hotspots)) {
    hotspots = raw.hotspots.map((h, idx) => {
      const posX = Array.isArray(h.position) ? Number(h.position[0]) || 0 : (Number(h.position?.x) || 0);
      const posY = Array.isArray(h.position) ? Number(h.position[1]) || 0 : (Number(h.position?.y) || 0);
      const posZ = Array.isArray(h.position) ? Number(h.position[2]) || 0 : (Number(h.position?.z) || 0);

      const panelX = h.panelOffset ? (Number(h.panelOffset.x) || 0) : 250;
      const panelY = h.panelOffset ? (Number(h.panelOffset.y) || 0) : -120;

      return {
        id: h.id || `hotspot_${Date.now()}_${idx}`,
        title: h.title !== undefined ? String(h.title) : "",
        description: h.description !== undefined ? String(h.description) : "",
        position: [posX, posY, posZ],
        panelOffset: { x: panelX, y: panelY },
        ...(h.color ? { color: h.color } : {}),
        ...(h.cameraViewpointId ? { cameraViewpointId: h.cameraViewpointId } : {})
      };
    });
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    metadata,
    scene,
    camera,
    model,
    lights,
    settings,
    hotspots
  };
}
