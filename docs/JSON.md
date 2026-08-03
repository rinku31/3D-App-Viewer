# JSON format

## Purpose

JSON documents store portable hotspot annotations for a product model. The Editor imports and exports a focused hotspot document. The Viewer loads a JSON file whose basename matches the GLB selected by the user.

For example, selecting `Viper V4 Pro.glb` makes the Viewer request:

```text
/Viewer/assets/Products/Viper V4 Pro.json
```

## Current schema

There is no `schemaVersion` field yet. The current format is permissive: applications use the properties they understand and ignore some optional properties.

```json
{
  "scene": {
    "background": "#3f3f3f",
    "environment": {
      "hdri": "studio_small_09",
      "intensity": 1.5,
      "exposure": 1.2,
      "toneMapping": "ACESFilmic"
    }
  },
  "camera": {},
  "model": {
    "rotation": { "x": 0, "y": 0, "z": 0 }
  },
  "lights": [],
  "settings": {
    "line": {
      "color": "#bfbfbf",
      "width": 1,
      "offset": { "x": 0, "y": 0 }
    }
  },
  "hotspots": [
    {
      "id": "hotspot_1710000000000",
      "title": "Optical sensor",
      "description": "High-precision tracking sensor.",
      "position": [0.25, -0.88, 0.19],
      "panelOffset": { "x": -667, "y": 0 }
    }
  ]
}
```

### Root properties

| Property | Type | Editor behavior | Viewer behavior |
| --- | --- | --- | --- |
| `scene` | object, optional | Imports and exports scene settings. Only `background` is applied during import. | Currently ignored. |
| `scene.background` | CSS color string | Sets the Editor scene background and color input. | Ignored. |
| `scene.environment` | object, optional | Retained in `sceneSettings` and re-exported; not applied from imported JSON. | Ignored. |
| `camera` | object, optional | Ignored. | Ignored. |
| `model` | object, optional | Ignored. | May contain `rotation`. |
| `model.rotation` | object, optional | Ignored. | Applies `x`, `y`, and `z` Euler rotation values to the loaded model; missing values default to `0`. |
| `lights` | array, optional | Ignored. | Ignored. |
| `settings` | object, optional | Exported as an empty object. | Reads optional `line` settings. |
| `settings.line` | object, optional | Ignored. | Sets connector line appearance. |
| `settings.line.color` | CSS color string | Ignored. | SVG stroke color; defaults to `#ffffff`. |
| `settings.line.width` | number | Ignored. | SVG stroke width; defaults to `2`. |
| `settings.line.offset` | `{ x, y }` | Ignored. | Offset added to the connector's hotspot endpoint; defaults to `{ "x": 0, "y": 0 }`. |
| `hotspots` | array, required for Editor import | Imported, edited, and exported. | Built as interactive overlays. |

### Hotspot properties

| Property | Type | Description |
| --- | --- | --- |
| `id` | string | Stable hotspot identifier. The Editor generates IDs using a `hotspot_` prefix plus a timestamp. |
| `title` | string | Panel heading. May be empty. |
| `description` | string | Panel body text. |
| `position` | number array `[x, y, z]` | World-space point on the loaded model. |
| `panelOffset` | object | Screen-space offset from the center of the render viewport. |
| `panelOffset.x` | number | Horizontal offset in CSS pixels. |
| `panelOffset.y` | number | Vertical offset in CSS pixels. |

The Editor requires `hotspots` to be an array when importing. Individual hotspot fields are expected to be present and well-formed; malformed fields are not yet schema-validated.

## Editor export behavior

The current Editor exports this reduced document:

```json
{
  "scene": { "...": "sceneSettings" },
  "settings": {},
  "hotspots": ["..."]
}
```

It does not currently export `camera`, `model`, `lights`, or line settings. This means model rotation, line styling, and Editor light changes from a richer source document will not survive an Editor export. Preserve an original JSON file when those fields matter.

## Compatibility expectations

- A Viewer can display JSON exported by the current Editor because it needs only the `hotspots` array; it will use default line styling.
- The Editor can import the bundled Viewer JSON because it contains `hotspots`; fields it does not implement are retained only where they are part of `sceneSettings` and otherwise are dropped on export.
- The Viewer requires its model/JSON filename convention and a server path with the exact `Products` directory casing.
- JSON should be UTF-8. Ensure text is correctly encoded so trademark and other non-ASCII characters render as intended.

## Future schema — planned, not implemented

JSON Schema v2 is planned in [ROADMAP.md](../ROADMAP.md). It will add an explicit schema version, validation, migration rules, and complete serialization for model metadata/transforms, camera, scene environment, lights, line styles, and hotspots.

Until then, do not add fields that require either application to change behavior without updating both applications and this document in the same change.
