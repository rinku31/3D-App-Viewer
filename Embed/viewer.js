/**
 * 3D Embed Viewer Module Export
 */
import { createViewerCore } from "../shared/viewerCore.js";

export { createViewerCore };
export async function bootstrapEmbedViewer() {
  return createViewerCore({ isEmbed: true, enableDrop: true });
}
