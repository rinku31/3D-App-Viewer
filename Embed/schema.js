/**
 * Embed Viewer Schema Bridge
 * Re-exports canonical Schema v2 definition from shared module.
 */

export * from "../shared/schema.js";
export { migrateSceneDocument as validateAndMigrateScene } from "../shared/schema.js";
