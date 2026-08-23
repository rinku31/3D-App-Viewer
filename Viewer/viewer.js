/**
 * 3D Hotspot Viewer - Entry Point
 * Modularized architecture (Phase 5)
 */

import { bootstrapViewer } from "./bootstrap/bootstrap.js";

document.addEventListener("DOMContentLoaded", () => {
  bootstrapViewer().catch((err) => {
    console.error("Fatal error during Viewer bootstrap:", err);
  });
});
