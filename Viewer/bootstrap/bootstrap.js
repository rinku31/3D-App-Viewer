/**
 * Viewer Bootstrap Module
 * Bridges to the unified shared viewerCore engine.
 */

import { createViewerCore } from "../../shared/viewerCore.js";

export async function bootstrapViewer() {
  return createViewerCore({ isEmbed: false, enableDrop: true });
}
