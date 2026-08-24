/**
 * 3D Hotspot Viewer - Entry Point
 * Modularized architecture (Phase 5)
 */

import { bootstrapViewer } from "./bootstrap/bootstrap.js";

function start() {
  bootstrapViewer().catch((err) => {
    console.error("Fatal error during Viewer bootstrap:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
