/**
 * Embed 3D Hotspot Viewer - Entry Point
 */

import { bootstrapEmbedViewer } from "./bootstrap/bootstrap.js";

document.addEventListener("DOMContentLoaded", () => {
  bootstrapEmbedViewer().catch((err) => {
    console.error("Fatal error during Embed Viewer bootstrap:", err);
  });
});
