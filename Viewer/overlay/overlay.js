/**
 * Viewer Overlay Module
 * Manages DOM hotspot markers, information cards, SVG lines, and coordinate projection.
 */

import { state } from "../state/state.js";
import { projectToScreen, calculateConnectorLine } from "../../shared/hotspotMath.js";

/**
 * Creates DOM and SVG elements for each hotspot in the current scene document.
 */
export function buildHotspotOverlays() {
  if (!state.overlay || !state.svg) return;

  // Clear existing DOM and SVG elements
  clearHotspotOverlays();

  if (!state.sceneDocument?.hotspots) return;

  state.hotspots = state.sceneDocument.hotspots.map((hData) => {
    const h = { ...hData, visible: true, active: false };

    // 1. Hotspot Marker Dot
    const dot = document.createElement("div");
    dot.className = "hotspot";
    if (h.color) {
      dot.style.setProperty("--hotspot-color", h.color);
    }

    // 2. Info Panel
    const panel = document.createElement("div");
    panel.className = "panel";

    const titleEl = document.createElement("div");
    titleEl.className = "panel-title";
    titleEl.style.fontWeight = "bold";
    titleEl.style.marginBottom = "6px";
    titleEl.textContent = h.title || "";

    const descEl = document.createElement("div");
    descEl.className = "panel-desc";
    descEl.textContent = h.description || "";

    panel.replaceChildren(titleEl, descEl);

    // 3. SVG Connector Line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.style.display = "none";

    // 4. Interaction Listeners (Hover on Desktop, Tap on Mobile)
    const showPanel = () => {
      h.active = true;
      panel.style.display = "block";
      line.style.display = "block";
      dot.classList.add("active");
    };

    const hidePanel = () => {
      h.active = false;
      panel.style.display = "none";
      line.style.display = "none";
      dot.classList.remove("active");
    };

    dot.addEventListener("mouseenter", showPanel);
    dot.addEventListener("mouseleave", hidePanel);

    // Mobile tap and desktop click to focus & inspect
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      if (h.active) {
        hidePanel();
      } else {
        // Hide others first
        state.hotspots.forEach((other) => {
          if (other !== h && other.panel) {
            other.active = false;
            other.panel.style.display = "none";
            if (other.line) other.line.style.display = "none";
            if (other.dot) other.dot.classList.remove("active");
          }
        });
        showPanel();

        // Smoothly fly camera to focus on this hotspot
        if (state.cameraRig && h.position) {
          state.cameraRig.flyToHotspot(h.position);
        }
      }
    });

    state.overlay.appendChild(dot);
    state.overlay.appendChild(panel);
    state.svg.appendChild(line);

    h.dot = dot;
    h.panel = panel;
    h.line = line;

    return h;
  });

  state.visibilityDirty = true;
}

/**
 * Updates 2D screen positions of hotspot dots, panels, and SVG connector lines.
 */
export function updateOverlayPositions() {
  if (!state.camera || !state.overlay || !state.hotspots.length) return;

  const overlayRect = state.overlay.getBoundingClientRect();
  const width = overlayRect.width || window.innerWidth;
  const height = overlayRect.height || window.innerHeight;

  const lineSettings = state.sceneDocument?.settings?.line || {};
  const lineOffset = lineSettings.offset || { x: 0, y: 0 };
  const lineColor = lineSettings.color || "#44D62C";
  const lineWidth = Number(lineSettings.width || 1.5);

  state.hotspots.forEach((h) => {
    if (!h.dot || !h.panel || !h.line) return;

    if (!h.visible) {
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      h.line.style.display = "none";
      return;
    }

    const { x, y, inFrustum } = projectToScreen(h.position, state.camera, width, height);

    if (!inFrustum) {
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      h.line.style.display = "none";
      return;
    }

    h.dot.style.display = "block";
    h.dot.style.left = `${x}px`;
    h.dot.style.top = `${y}px`;

    const panelWidth = 260;
    const panelHeight = 90;
    const rawPanelX = width * 0.5 + (h.panelOffset?.x || 0);
    const rawPanelY = height * 0.5 + (h.panelOffset?.y || 0);

    // Screen edge clamping to keep cards visible on mobile and smaller viewports
    const panelX = Math.max(12, Math.min(width - panelWidth - 12, rawPanelX));
    const panelY = Math.max(60, Math.min(height - panelHeight - 75, rawPanelY));

    h.panel.style.left = `${panelX}px`;
    h.panel.style.top = `${panelY}px`;
    h.panel.style.transform = "none";

    const coords = calculateConnectorLine(x, y, panelX, panelY, lineOffset);

    h.line.setAttribute("x1", coords.x1);
    h.line.setAttribute("y1", coords.y1);
    h.line.setAttribute("x2", coords.x2);
    h.line.setAttribute("y2", coords.y2);
    h.line.setAttribute("stroke", lineColor);
    h.line.setAttribute("stroke-width", lineWidth);
  });
}

/**
 * Cleans up DOM elements and SVG lines for all hotspots.
 */
export function clearHotspotOverlays() {
  if (state.overlay) {
    state.overlay.querySelectorAll(".hotspot, .panel").forEach((el) => el.remove());
  }
  if (state.svg) {
    state.svg.innerHTML = "";
  }
  state.hotspots = [];
}
