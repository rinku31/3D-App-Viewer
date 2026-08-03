# Deferred engineering work

This list contains implementation-level work that supports the product roadmap but is intentionally not scheduled as a user-facing feature by itself. See [ROADMAP.md](ROADMAP.md) for product milestones.

## Shared Editor/Viewer modules

Extract common Three.js initialization, camera framing, hotspot projection, visibility testing, and overlay rendering into a shared module with a small, explicit public API.

## JSON schema versioning

Define, validate, and migrate a versioned scene-document schema so Editor and Viewer compatibility is explicit rather than inferred from optional properties.

## Resource disposal

Introduce lifecycle cleanup for replaced models, geometries, materials, textures, render targets, HDR/PMREM resources, and editor helper objects.

## Event listener consolidation

Replace per-hotspot global pointer listeners with a delegated interaction controller and explicit teardown during removal or import.

## Viewer modularization

Split the Viewer runtime into asset loading, rendering, hotspot overlay, visibility, and bootstrap modules without changing its public behavior.
