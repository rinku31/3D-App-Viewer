/**
 * Embed Viewer Overlay Module
 * Manages DOM hotspot markers, information cards, SVG connector lines, and screen projection.
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

    const children = [];

    const titleEl = document.createElement("div");
    titleEl.className = "panel-title";
    titleEl.style.fontWeight = "bold";
    titleEl.style.marginBottom = "6px";
    titleEl.textContent = h.title || "";
    children.push(titleEl);

    if (h.description) {
      const descEl = document.createElement("div");
      descEl.className = "panel-desc";
      descEl.textContent = h.description || "";
      children.push(descEl);
    }

    // List items
    const rawList = Array.isArray(h.listItems) ? h.listItems : (Array.isArray(h.items) ? h.items : []);
    const validItems = rawList.map((item) => String(item || "").trim()).filter(Boolean);

    if (validItems.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "panel-list";
      ul.style.margin = "8px 0 0 0";
      ul.style.paddingLeft = "18px";
      ul.style.display = "flex";
      ul.style.flexDirection = "column";
      ul.style.gap = "4px";

      validItems.forEach((itemText) => {
        const li = document.createElement("li");
        li.className = "panel-list-item";
        li.style.fontSize = "0.82rem";
        li.style.lineHeight = "1.4";
        li.textContent = itemText;
        ul.appendChild(li);
      });

      children.push(ul);
    }

    // Action button
    if (h.button && h.button.enabled) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "panel-btn";
      btn.textContent = h.button.text || "Show Article";
      btn.style.marginTop = "10px";
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.gap = "6px";
      btn.style.width = "100%";
      btn.style.padding = "7px 12px";
      btn.style.fontSize = "0.8rem";
      btn.style.fontWeight = "600";
      btn.style.borderRadius = "6px";
      btn.style.border = "1px solid rgba(255,255,255,0.2)";
      btn.style.background = "rgba(68, 214, 44, 0.25)";
      btn.style.color = "#ffffff";
      btn.style.cursor = "pointer";
      btn.style.pointerEvents = "auto";
      btn.style.transition = "all 0.2s ease";

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const url = (h.button?.url || "").trim();
        const funcName = (h.button?.jsFunction || "").trim();

        if (url) {
          try {
            window.open(url, "_blank", "noopener,noreferrer");
          } catch (_) {}
        }

        if (funcName) {
          try {
            if (window.parent && typeof window.parent[funcName] === "function") {
              window.parent[funcName](h);
            } else if (typeof window[funcName] === "function") {
              window[funcName](h);
            }

            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: "HOTSPOT_BUTTON_CLICK",
                functionName: funcName,
                hotspot: {
                  id: h.id,
                  title: h.title,
                  description: h.description,
                  position: h.position
                }
              }, "*");
            }
          } catch (_) {}
        }
      });

      children.push(btn);
    }

    panel.replaceChildren(...children);

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

  const width = state.overlay.clientWidth || window.innerWidth;
  const height = state.overlay.clientHeight || window.innerHeight;

  const lineSettings = state.sceneDocument?.settings?.line || {};
  const lineOffset = lineSettings.offset || { x: 0, y: 0 };
  const lineColor = lineSettings.color || "#44D62C";
  const lineWidth = Number(lineSettings.width || 1.5);

  state.hotspots.forEach((h) => {
    if (!h.dot || !h.panel || !h.line) return;

    if (!h.visible) {
      if (h.dot.style.display !== "none") h.dot.style.display = "none";
      if (h.panel.style.display !== "none") h.panel.style.display = "none";
      if (h.line.style.display !== "none") h.line.style.display = "none";
      return;
    }

    const { x, y, inFrustum } = projectToScreen(h.position, state.camera, width, height);

    if (!inFrustum) {
      if (h.dot.style.display !== "none") h.dot.style.display = "none";
      if (h.panel.style.display !== "none") h.panel.style.display = "none";
      if (h.line.style.display !== "none") h.line.style.display = "none";
      return;
    }

    if (h.dot.style.display !== "block") h.dot.style.display = "block";
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
