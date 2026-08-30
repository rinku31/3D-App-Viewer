/**
 * 3D Embed Viewer Entry Point (Optimized for iframes)
 */
import { createViewerCore } from "../shared/viewerCore.js";

window.addEventListener("DOMContentLoaded", async () => {
  try {
    window.viewerInstance = await createViewerCore({
      isEmbed: true,
      enableDrop: true
    });
  } catch (err) {
    console.error("Error bootstrapping 3D Embed Viewer:", err);
  }
});
