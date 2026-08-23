/**
 * Scene Schema v2 Definition & Validator & Migrator (Shared)
 * 
 * Standard specification for 3D App Viewer / Editor scene documents.
 * Single source of truth for Schema v2.0.0.
 */

export const CURRENT_SCHEMA_VERSION = "2.0.0";
export const SUPPORTED_SCHEMA_VERSIONS = ["1.0.0", "1.1.0", "2.0.0"];

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
        shadowType: "pcfsoft"
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

  const camera = {
    ...base.camera,
    ...(raw.camera || {})
  };
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
      const type = ["directional", "point", "spot", "ambient"].includes(l.type) ? l.type : "directional";
      const lightEntry = {
        id: l.id || `light_${idx + 1}_${Date.now().toString(36)}`,
        name: l.name || `${type.charAt(0).toUpperCase() + type.slice(1)} Light`,
        type,
        color: l.color || "#ffffff",
        intensity: typeof l.intensity === "number" ? l.intensity : 2.0,
        castShadow: l.castShadow !== undefined ? Boolean(l.castShadow) : true,
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
