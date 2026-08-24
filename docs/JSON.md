# JSON Schema v2 Specification

## 1. Overview

The 3D App Viewer & Editor interchange format utilizes **JSON Schema v2.0.0**. It represents the canonical scene document structure shared between authoring and presentation environments.

## 2. Top-Level Structure

```json
{
  "version": "2.0.0",
  "metadata": {
    "title": "Model Presentation",
    "author": "3D Artist",
    "createdAt": "2026-08-22T00:00:00.000Z",
    "updatedAt": "2026-08-22T14:30:00.000Z",
    "generator": "3D App Viewer Editor v2.0.0",
    "tags": ["product", "interactive"]
  },
  "scene": {
    "background": "#222228",
    "backgroundType": "color",
    "backgroundBlur": 0.0,
    "environment": {
      "preset": "studio_small_09",
      "customHdrUrl": null,
      "intensity": 1.5,
      "rotation": 0.0,
      "exposure": 1.6,
      "toneMapping": "ACESFilmic"
    },
    "rendering": {
      "shadows": true,
      "shadowType": "pcfsoft"
    },
    "helpers": {
      "grid": true,
      "axes": false
    }
  },
  "camera": {
    "fov": 45,
    "near": 0.01,
    "far": 1000,
    "minDistance": 1.35,
    "maxDistance": 16.0,
    "position": [0, 1.2, 4.0],
    "target": [0, 0, 0],
    "distance": 4.0,
    "yaw": 0.0,
    "pitch": 0.0,
    "viewpoints": [
      {
        "id": "vp_front",
        "name": "Front View",
        "target": [0, 0, 0],
        "distance": 3.5,
        "yaw": 0.0,
        "pitch": 0.2,
        "fov": 45
      }
    ]
  },
  "model": {
    "name": "Viper V4 Pro",
    "filename": "Viper V4 Pro.glb",
    "position": [0, 0, 0],
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": [1, 1, 1]
  },
  "lights": [
    {
      "id": "key_light",
      "name": "Key Light",
      "type": "directional",
      "color": "#ffffff",
      "intensity": 2.2,
      "castShadow": true,
      "position": [4, 8, 4],
      "target": [0, 0, 0]
    },
    {
      "id": "fill_point",
      "name": "Fill Point",
      "type": "point",
      "color": "#90c8ff",
      "intensity": 1.5,
      "castShadow": false,
      "position": [-3, 2, -2],
      "distance": 15,
      "decay": 2
    }
  ],
  "settings": {
    "line": {
      "color": "#44D62C",
      "width": 1.5,
      "offset": { "x": 0, "y": 0 }
    },
    "hotspots": {
      "pulseAnimation": true,
      "theme": "default",
      "occlusionTolerance": 0.08
    }
  },
  "hotspots": [
    {
      "id": "hotspot_1",
      "title": "Feature Title",
      "description": "Detailed explanation of feature.",
      "position": [0.1, 0.5, -0.2],
      "panelOffset": { "x": 300, "y": -150 },
      "color": "#44D62C",
      "cameraViewpointId": "vp_front"
    }
  ]
}
```

## 3. Schema Fields & Types

### 3.1 Metadata
- `title` (`string`): Human-readable scene display name.
- `author` (`string`): Creator/author identifier.
- `createdAt` (`ISO 8601 string`): Creation timestamp.
- `updatedAt` (`ISO 8601 string`): Last modified timestamp.
- `generator` (`string`): Generating tool identifier.
- `tags` (`string[]`): Search and taxonomy tags.

### 3.2 Scene & Environment
- `background` (`string`): Hex/CSS color value (`#222228`).
- `backgroundType` (`"color" | "environment" | "transparent"`): Viewport clear strategy.
- `backgroundBlur` (`number [0.0 - 1.0]`): Skybox background blur level.
- `environment.preset` (`string`): Preset ID (`studio_small_09`, `sunset_fairway`, `puresky`, `workshop`, `city_night`).
- `environment.intensity` (`number >= 0`): HDR irradiance and reflection strength.
- `environment.exposure` (`number > 0`): Renderer tone mapping exposure multiplier.
- `environment.toneMapping` (`"ACESFilmic" | "AgX" | "Cineon" | "Reinhard" | "Linear" | "None"`).
- `rendering.shadows` (`boolean`): Soft shadow mapping toggle.

### 3.3 Camera & Viewpoints
- `fov` (`number [5 - 140]`): Field of view in degrees.
- `near` / `far` (`number`): Frustum clipping distances in scene units.
- `minDistance` (`number > 0`): Nearest allowed orbit zoom limit in scene units.
- `maxDistance` (`number > minDistance`): Farthest allowed orbit zoom limit in scene units.
- `position` (`[number, number, number]`): Camera world position.
- `target` (`[number, number, number]`): Orbit/lookAt focal center.
- `viewpoints` (`Array<Viewpoint>`): Saved camera angles for guided tours or hotspot associations.

### 3.4 Model
- `name` (`string`): Display name of model asset.
- `filename` (`string`): Relative GLB filename reference.
- `position` (`[x, y, z]`): Model origin translation.
- `rotation` (`{ x, y, z }`): Euler angles in radians.
- `scale` (`[x, y, z]`): Local scaling factors.

### 3.5 Lights
- `id` (`string`): Unique light identifier.
- `name` (`string`): Display name in Hierarchy outliner.
- `type` (`"directional" | "point" | "spot" | "area" | "ambient"`): Light emitter type.
- `color` (`string`): Light color in hex format (`#ffffff`).
- `intensity` (`number >= 0`): Luminous intensity.
- `castShadow` (`boolean`): Real-time shadow casting toggle.
- `position` (`[x, y, z]`): Emitter location (point, spot, directional, area).
- `target` (`[x, y, z]`): Directional, spotlight, and area softbox aim vector.
- `width` (`number`, for area softbox): Softbox width in meters (default `2.5`).
- `height` (`number`, for area softbox): Softbox height in meters (default `2.5`).
- `distance` (`number`): Attenuation cutoff distance.
- `decay` (`number`): Physical attenuation falloff rate.
- `angle` (`number`): Spotlight cone angle in radians.
- `penumbra` (`number [0 - 1]`): Spotlight cone soft edge ratio.
- `radius` (`number`): Contact shadow penumbra blur radius (default `2.0`).

### 3.6 Hotspots & Annotations
- `id` (`string`): Unique hotspot identifier.
- `title` (`string`): Headline text rendered in info overlay panel.
- `description` (`string`): Detailed description body.
- `position` (`[x, y, z]`): 3D anchor point on model surface.
- `panelOffset` (`{ x: number, y: number }`): 2D screen offset from viewport center.
- `color` (`string, optional`): Custom hotspot accent color override.
- `cameraViewpointId` (`string, optional`): Linked viewpoint triggered on interaction.

## 4. Migration & Backward Compatibility
- **Legacy v1 Documents** (`schemaVersion: "1.0.0"` or untyped JSON) are automatically detected and migrated to canonical v2.0.0 by both the Editor (`Editor/io/schema.js`) and Viewer (`Viewer/schema.js`).
- Migrator populates missing environment presets, camera parameters, light targets, and panel offset coordinates with robust defaults without breaking existing annotations.
