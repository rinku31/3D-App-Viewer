/**
 * Embed Bootstrap Module
 * Bridges to the unified shared viewerCore engine.
 */

import { createViewerCore } from "../../shared/viewerCore.js";

export async function bootstrapEmbedViewer() {
  return createViewerCore({ isEmbed: true, enableDrop: true });
}
