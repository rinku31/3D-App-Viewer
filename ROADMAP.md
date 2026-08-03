# Product Roadmap

This roadmap describes the intended evolution of 3D App Viewer. The phases provide direction rather than a release promise; work should be prioritized only when it supports a real authoring or presentation need.

## Phase 1 — Foundation ✔ Completed

The foundation establishes the minimum useful authoring-to-viewing loop: import a GLB, author hotspots, export JSON, and display those hotspots in a browser-based Viewer. It proves the product workflow and gives future work a stable baseline rather than starting from abstract tooling.

Delivered capabilities include model framing, hotspot placement and dragging, hotspot import/export, editor directional lights, Viewer overlays, and visibility checks.

## Phase 2 — Editor Maturity

This phase makes the Editor feel like a dependable scene-authoring tool. The current interaction model is hotspot-focused; broader, consistent object interaction is needed before more scene types are introduced.

- **Universal Selection** — select hotspots, lights, models, and future scene objects through one predictable system.
- **Blender-style Transform Gizmos** — provide visual translate, rotate, and scale controls so users can edit spatial data accurately.
- **Generic Inspector** — centralize property editing instead of adding one-off control panels per object type.
- **Scene Hierarchy** — expose the scene structure and make object relationships discoverable.

## Phase 3 — Scene System

This phase evolves the product from hotspot authoring into scene authoring. It exists so the Viewer can faithfully reproduce a deliberately composed product presentation rather than relying on fixed defaults.

- **Scene Settings** — persist background, rendering, and presentation options.
- **Camera Editor** — author camera position, target, and projection deliberately.
- **Multiple Light Types** — support ambient, directional, point, spot, and future light presets.
- **Environment Controls** — select HDR environments and tune intensity, exposure, and tone mapping.

## Phase 4 — Scene Serialization

This phase creates a reliable long-lived interchange format. A versioned contract allows the Editor and Viewer to evolve independently without silently breaking published product scenes.

- **JSON Schema v2** — define the complete scene, camera, lights, model metadata, styling, and hotspot payload.
- **Scene Versioning** — validate versions and migrate older documents where feasible.

## Phase 5 — Viewer

This phase makes the Viewer easier to extend and keeps it aligned with authored scenes. It is intentionally sequenced after serialization because a Viewer refactor should target a stable contract.

- **Viewer Refactor** — split the Viewer into focused rendering, loading, overlay, visibility, and bootstrap modules.
- **Shared Modules** — extract genuinely shared rendering and hotspot primitives while keeping Editor interaction and Viewer presentation distinct.

## Phase 6 — Productivity

This phase reduces authoring friction and enables controlled extensibility. These features matter once the Editor has a reliable object model and serialization format.

- **Undo/Redo** — safely recover from editing mistakes.
- **Snap** — align transforms and placements with predictable increments.
- **Grid** — provide visual spatial context for scene editing.
- **Keyboard Shortcuts** — support efficient expert workflows.
- **Plugin Architecture** — allow optional extensions without destabilizing the core product.

## Guiding principle

Complete the architectural prerequisites for a phase before layering on its visible features. This keeps the Editor, serialized scene data, and Viewer behavior compatible as the project grows.
