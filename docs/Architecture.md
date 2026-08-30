# Architecture

## High-Level System Architecture

3D App Viewer is structured as a modular suite of browser-based 3D applications powered by a shared core engine (`/shared/`):

```mermaid
flowchart TD
  subgraph SharedEngine ["Shared 3D Core Engine (/shared/)"]
    Schema[schema.js - Canonical Schema v2]
    Camera[CameraRig.js - Collision-Safe Orbit & Fly-To]
    Loader[viewerLoader.js - GLTF/Draco & Scene Loader]
    Overlay[hotspotOverlay.js - 2D/3D Projection & SVG]
    HUD[viewerHUD.js - Turntable, Exploded View, Simulator]
    Env[environment.js - HDR Presets & Tone Mapping]
    Bloom[bloom.js - Post-Processing Glow]
    Lights[lights.js - 3-Point Light Rig & Sync]
    Disposal[disposal.js - Deep GPU Cleanup]
    Core[viewerCore.js - Unified Presentation Engine]
  end

  Author[3D Author] --> Editor[Editor (/Editor/)]
  Editor -->|Author & Export Scene JSON| SchemaDoc[Schema v2 JSON Document]

  Core --> ViewerApp[Presentation Viewer (/Viewer/)]
  Core --> EmbedApp[Embeddable Iframe Player (/Embed/)]

  ModelFile[GLB/glTF 3D Model] --> Core
  SchemaDoc --> Core
```

All applications use native ES modules and Three.js via CDN import maps. Shared runtime primitives reside in `/shared/`, ensuring 100% feature parity, performance optimizations, and schema compatibility across Editor, Viewer, and Embed views.

---

## Module Responsibilities

### Shared Core Engine (`/shared/`)

| Module | Responsibility |
| :--- | :--- |
| `viewerCore.js` | Universal 3D presentation engine orchestrator. Manages WebGL renderer, camera rig, render loop, resize observer, URL query parameter ingestion, drag-and-drop, and postMessage bidirectional communication. |
| `viewerLoader.js` | Unified GLTF / Draco mesh loader, bounding-box auto-framing, scene JSON ingestion, backward migration, and loading overlay spinners. |
| `viewerHUD.js` | Interactive UI controls: floating HUD pill, continuous 360° turntable with 0.5x–3x speeds, exploded view parts separation, simulator triggers with custom JS execution, HDR preset selector, and 3.5s inactivity auto-hide. |
| `hotspotOverlay.js` | Screen-space annotation system: 2D pin placement, multi-section cards with bullet lists and action buttons, external URL navigation, and animated SVG leader lines. |
| `hotspotMath.js` | Mathematical primitives: 3D coordinate projection (`projectToScreen`), geometric occlusion raycasting (`testHotspotOcclusion`), and SVG connector boundary math (`calculateConnectorLine`). |
| `CameraRig.js` | Multi-pivot orbit rig with smooth damping, anti-clipping obstruction checking, target framing, and smooth fly-to hotspot transitions. |
| `schema.js` | Canonical Schema v2.0.0 specification, schema migration pipeline, document validation, and asset URL sanitization. |
| `environment.js` | HDR presets (`studio_small_09`, `potsdamer_platz`, `autumn_ground`, `aircraft_workshop`), background modes (color, blur, transparent), and exposure control. |
| `bloom.js` | Post-processing UnrealBloomPass pipeline for selective emissive bloom. |
| `lights.js` | Factory functions for scene lights (Directional, Point, Spot, Ambient) and preset lighting rigs. |
| `disposal.js` | Deep GPU memory cleanup for geometries, materials, textures, render targets, and scene hierarchies. |

---

### Authoring Editor (`/Editor/`)

| Module | Responsibility |
| :--- | :--- |
| `editor.html` / `editor.js` | Authoring interface layout and initialization. |
| `hierarchy/` | Scene outliner tree with real-time mesh filtering, visibility toggling, and framing. |
| `inspector/` | Dynamic property inspector for transforms, materials, lights, and hotspot properties. |
| `gizmo/` | Three.js TransformControls integration for translation, rotation, and scaling. |
| `hotspots/` | Interactive hotspot placement, surface snapping, and visual annotation editing. |
| `selection/` | Raycast-based object selection and highlight system. |
| `lights/` | Interactive light authoring with editor helpers and Kelvin color temperature conversion. |
| `io/` | Import/export pipeline for GLB models and Schema v2 JSON scene files. |
| `state/` | Undo/redo history stack and reactive editor state. |

---

### Presentation Viewer (`/Viewer/`)

| Module | Responsibility |
| :--- | :--- |
| `viewer.html` / `viewer.js` | Full-screen presentation showcase entry point with top navigation bar and manual model loading. |
| `style.css` | High-contrast dark theme styling for header, floating pills, and hotspot overlays. |
| `assets/Products/` | Bundled product showcases and companion JSON files. |

---

### Embed Player (`/Embed/`)

| Module | Responsibility |
| :--- | :--- |
| `index.html` / `embed.js` | Minimalist iframe entry point designed for seamless embedding in third-party websites, CMSs, and web apps. |
| `style.css` | Compact, borderless responsive styling with auto-hiding chrome controls. |

---

## Data Flow & Ingestion Pipeline

1. **Model & Scene Ingestion**:
   - URL parameters (`?glb=`, `?json=`, `?env=`, `?turntable=`, `?speed=`) or drag-and-dropped files are parsed by `viewerCore.js`.
   - `viewerLoader.js` streams the 3D model using DRACO decompression and loads companion scene documents.
2. **Schema Migration**:
   - `schema.js` validates documents against Schema v2.0.0 and automatically migrates legacy scene definitions.
3. **Render & Interaction Loop**:
   - Per-frame: `CameraRig` updates orbital damping & turntable rotation.
   - Throttled raycasting performs occlusion testing to hide obstructed hotspots.
   - SVG leader lines and HTML cards update screen coordinates based on projected 3D positions.
4. **External Integration**:
   - User interactions dispatch bidirectional `window.postMessage` events and trigger configured JavaScript callbacks.
