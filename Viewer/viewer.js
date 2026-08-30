/**
 * 3D Presentation Viewer Entry Point
 */
import { createViewerCore } from "../shared/viewerCore.js";

window.addEventListener("DOMContentLoaded", async () => {
  try {
    window.viewerInstance = await createViewerCore({
      isEmbed: false,
      enableDrop: true
    });
  } catch (err) {
    console.error("Error bootstrapping 3D Presentation Viewer:", err);
  }
});
