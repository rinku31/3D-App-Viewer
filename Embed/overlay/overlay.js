/**
 * Embed Viewer Overlay Module
 * Manages DOM hotspot markers, information cards, SVG connector lines, and screen projection.
 */

import { state } from "../state/state.js";
import { projectToScreen, calculateConnectorLine } from "../../shared/hotspotMath.js";

let _globalListenersAttached = false;

function setupGlobalListeners() {
  if (_globalListenersAttached) return;
  _globalListenersAttached = true;

  const dismissAllHotspots = () => {
    state.hotspots?.forEach((h) => {
      if (h.pinned || h.active) {
        h.pinned = false;
        h.active = false;
        if (h.panel) h.panel.style.display = "none";
        if (h.line) h.line.style.display = "none";
        if (h.dot) h.dot.classList.remove("active");
      }
    });
  };

  // Close persistent panels on model/camera rotation
  window.addEventListener("modelrotated", dismissAllHotspots);

  // Close persistent panels when clicking outside any hotspot, panel, or floating HUD UI
  window.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".hotspot") || e.target.closest(".panel") || e.target.closest(".embed-hud")) {
      return;
    }
    dismissAllHotspots();
  });
}

/**
 * Creates DOM and SVG elements for each hotspot in the current scene document.
 */
export function buildHotspotOverlays() {
  setupGlobalListeners();

  if (!state.overlay || !state.svg) return;

  // Clear existing DOM and SVG elements
  clearHotspotOverlays();

  if (!state.sceneDocument?.hotspots) return;

  const globalPanelBg = state.sceneDocument?.settings?.hotspots?.panelColor;
  const globalTitleFontColor = state.sceneDocument?.settings?.hotspots?.titleFontColor || "#ffffff";
  const globalTitleFontSize = Number(state.sceneDocument?.settings?.hotspots?.titleFontSize || 14);
  const globalDescFontColor = state.sceneDocument?.settings?.hotspots?.descFontColor || "#e0e0e0";
  const globalDescFontSize = Number(state.sceneDocument?.settings?.hotspots?.descFontSize || 12.5);
  const globalListFontColor = state.sceneDocument?.settings?.hotspots?.listFontColor || "#cccccc";
  const globalListFontSize = Number(state.sceneDocument?.settings?.hotspots?.listFontSize || 11);

  state.hotspots = state.sceneDocument.hotspots.map((hData) => {
    const h = { ...hData, visible: true, active: false, pinned: false };

    // 1. Hotspot Marker Dot
    const dot = document.createElement("div");
    dot.className = "hotspot";
    if (h.color) {
      dot.style.setProperty("--hotspot-color", h.color);
    }

    // 2. Info Panel
    const panel = document.createElement("div");
    panel.className = "panel";
    if (globalPanelBg) {
      panel.style.backgroundColor = globalPanelBg;
    }
    const children = [];

    const titleEl = document.createElement("div");
    titleEl.className = "panel-title";
    titleEl.style.fontWeight = "bold";
    titleEl.style.fontSize = `${globalTitleFontSize}px`;
    titleEl.style.color = globalTitleFontColor;
    titleEl.style.marginBottom = "5px";
    titleEl.textContent = h.title || "";
    children.push(titleEl);

    if (h.description) {
      const descEl = document.createElement("div");
      descEl.className = "panel-desc";
      descEl.style.fontSize = `${globalDescFontSize}px`;
      descEl.style.color = globalDescFontColor;
      descEl.style.marginBottom = "4px";
      descEl.textContent = h.description || "";
      children.push(descEl);
    }

    // List items without list decorations/bullets but retaining left indentation
    const rawList = Array.isArray(h.listItems) ? h.listItems : (Array.isArray(h.items) ? h.items : []);
    const validItems = rawList.map((item) => String(item || "").trim()).filter(Boolean);

    if (validItems.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "panel-list";
      ul.style.margin = "6px 0 0 0";
      ul.style.padding = "0 0 0 16px";
      ul.style.listStyle = "none";
      ul.style.listStyleType = "none";
      ul.style.display = "flex";
      ul.style.flexDirection = "column";
      ul.style.gap = "4px";

      validItems.forEach((itemText) => {
        const li = document.createElement("li");
        li.className = "panel-list-item";
        li.style.listStyle = "none";
        li.style.listStyleType = "none";
        li.style.padding = "0";
        li.style.margin = "0";
        li.style.fontSize = `${globalListFontSize}px`;
        li.style.color = globalListFontColor;
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

    // 4. Interaction Listeners (Persistent open on click, preview on hover, dismiss on rotate)
    const showPanel = () => {
      h.active = true;
      panel.style.display = "block";
      line.style.display = "block";
      dot.classList.add("active");
    };

    const hidePanel = () => {
      h.active = false;
      h.pinned = false;
      panel.style.display = "none";
      line.style.display = "none";
      dot.classList.remove("active");
    };

    h.show = showPanel;
    h.hide = hidePanel;

    dot.addEventListener("mouseenter", () => {
      if (!h.pinned) {
        showPanel();
      }
    });

    dot.addEventListener("mouseleave", () => {
      if (!h.pinned) {
        hidePanel();
      }
    });

    // Clicking the spot will cause the panel to be shown persistently, unless model is rotated or spot is clicked again
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      if (h.pinned) {
        h.pinned = false;
        hidePanel();
      } else {
        // Hide/unpin any other hotspots first
        state.hotspots.forEach((other) => {
          if (other !== h) {
            other.pinned = false;
            other.active = false;
            if (other.panel) other.panel.style.display = "none";
            if (other.line) other.line.style.display = "none";
            if (other.dot) other.dot.classList.remove("active");
          }
        });
        h.pinned = true;
        showPanel();
      }
    });

    // Suppress double-click to prevent camera focus, text selection, or zooming
    dot.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    panel.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      e.preventDefault();
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
  const lineStyle = lineSettings.style || "dashed";
  const lineColor = lineSettings.color || "#44D62C";
  const lineWidth = Number(lineSettings.width || 1.5);
  const panelBg = state.sceneDocument?.settings?.hotspots?.panelColor;

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

    const panelWidth = h.panel.offsetWidth || 220;
    const panelHeight = h.panel.offsetHeight || 60;
    const rawPanelX = width * 0.5 + (h.panelOffset?.x || 0);
    const rawPanelY = height * 0.5 + (h.panelOffset?.y || 0);

    // Screen edge clamping to keep cards visible on mobile and smaller viewports
    const panelX = Math.max(12, Math.min(width - panelWidth - 12, rawPanelX));
    const panelY = Math.max(60, Math.min(height - panelHeight - 75, rawPanelY));

    h.panel.style.left = `${panelX}px`;
    h.panel.style.top = `${panelY}px`;

    if (panelBg) {
      h.panel.style.backgroundColor = panelBg;
    }

    // Connect line from spot to center of panel
    const coords = calculateConnectorLine(x, y, panelX, panelY, panelWidth, panelHeight, lineOffset);

    h.line.setAttribute("x1", coords.x1);
    h.line.setAttribute("y1", coords.y1);
    h.line.setAttribute("x2", coords.x2);
    h.line.setAttribute("y2", coords.y2);
    h.line.setAttribute("stroke", lineColor);
    h.line.setAttribute("stroke-width", String(lineWidth));
    h.line.style.stroke = lineColor;
    h.line.style.strokeWidth = `${lineWidth}px`;

    if (lineStyle === "solid") {
      h.line.classList.remove("dashed-line");
      h.line.classList.add("solid-line");
      h.line.style.strokeDasharray = "none";
      h.line.style.animation = "none";
    } else {
      h.line.classList.remove("solid-line");
      h.line.classList.add("dashed-line");
      h.line.style.strokeDasharray = "4, 3";
      h.line.style.animation = "dash 1s linear infinite";
    }
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
