/**
 * Embed 3D Hotspot Viewer - Entry Point
 * Streamlined standalone package for iframe embedding and dynamic query params.
 */

import { bootstrapEmbedViewer } from "./bootstrap/bootstrap.js";

function start() {
  bootstrapEmbedViewer().catch((err) => {
    console.error("Fatal error during Embed Viewer bootstrap:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
