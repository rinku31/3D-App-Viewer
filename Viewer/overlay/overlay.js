import { state } from "../state/state.js";
import { projectToScreen, calculateConnectorLine } from "../../shared/hotspotMath.js";

export function buildHotspotOverlays() {
  clearHotspotOverlays();
  if (!state.sceneDocument?.hotspots) return;

  state.hotspots = state.sceneDocument.hotspots.map((hData) => {
    const h = { ...hData, position: [...hData.position] };
    
    const dot = document.createElement("div");
    dot.className = "hotspot";
    dot.style.setProperty("--hotspot-color", h.color || "#44D62C");
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    state.svgOverlay.appendChild(line);
    
    const panel = document.createElement("div");
    panel.className = "panel";
    
    // Close persistent panels when clicking outside
    // Viewer UI specific
    
    updatePanelHTML(h, panel);
    
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      state.hotspots.forEach(other => {
        if (other !== h && other.panel) {
          other.panel.classList.remove("visible");
        }
      });
      panel.classList.toggle("visible");
    });
    
    state.overlay.appendChild(dot);
    state.overlay.appendChild(panel);
    
    h.dot = dot;
    h.line = line;
    h.panel = panel;
    
    return h;
  });
  
  // Close panels on background click
  window.addEventListener("click", (e) => {
    if (e.target.closest(".hotspot") || e.target.closest(".panel") || e.target.closest(".viewer-hud") || e.target.closest("#viewerHeader")) {
      return;
    }
    state.hotspots?.forEach(h => {
      if (h.panel) h.panel.classList.remove("visible");
    });
  });
}

function updatePanelHTML(h, panel) {
  const children = [];

  const titleFontColor = state.sceneDocument?.settings?.hotspots?.titleFontColor || "#ffffff";
  const titleFontSize = Number(state.sceneDocument?.settings?.hotspots?.titleFontSize || 14);
  const descFontColor = state.sceneDocument?.settings?.hotspots?.descFontColor || "#e0e0e0";
  const descFontSize = Number(state.sceneDocument?.settings?.hotspots?.descFontSize || 12.5);
  const listFontColor = state.sceneDocument?.settings?.hotspots?.listFontColor || "#cccccc";
  const listFontSize = Number(state.sceneDocument?.settings?.hotspots?.listFontSize || 11);

  const title = document.createElement("div");
  title.className = "panel-title";
  title.style.fontWeight = "bold";
  title.style.fontSize = `${titleFontSize}px`;
  title.style.color = titleFontColor;
  title.style.marginBottom = "5px";
  title.textContent = h.title || "";
  children.push(title);

  const sections = Array.isArray(h.sections) ? h.sections : [];

  sections.forEach((sec, secIdx) => {
    const secContainer = document.createElement("div");
    secContainer.className = "panel-section-block";
    secContainer.style.marginTop = secIdx > 0 ? "12px" : "8px";

    if (sec.description) {
      const description = document.createElement("div");
      description.className = "panel-desc";
      description.style.fontSize = `${descFontSize}px`;
      description.style.color = descFontColor;
      description.style.marginBottom = "6px";
      description.textContent = sec.description;
      secContainer.appendChild(description);
    }

    const rawItems = Array.isArray(sec.listItems) ? sec.listItems : (Array.isArray(sec.items) ? sec.items : []);
    const validItems = rawItems.map((item) => String(item || "").trim()).filter(Boolean);

    if (validItems.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "panel-list";
      ul.style.margin = "6px 0 0 0";
      ul.style.padding = "0 0 0 16px";
      ul.style.listStyle = "none";
      ul.style.display = "flex";
      ul.style.flexDirection = "column";
      ul.style.gap = "4px";

      validItems.forEach((itemText) => {
        const li = document.createElement("li");
        li.className = "panel-list-item";
        li.style.fontSize = `${listFontSize}px`;
        li.style.color = listFontColor;
        li.style.lineHeight = "1.4";
        li.textContent = itemText;
        ul.appendChild(li);
      });

      secContainer.appendChild(ul);
    }

    const buttons = Array.isArray(sec.buttons) ? sec.buttons : [];

    if (buttons.length > 0) {
      const btnContainer = document.createElement("div");
      btnContainer.style.display = "flex";
      btnContainer.style.flexDirection = "column";
      btnContainer.style.alignItems = "flex-end";
      btnContainer.style.gap = "6px";
      btnContainer.style.marginTop = "12px";
      btnContainer.style.width = "100%";

      buttons.forEach((bData) => {
        if (!bData.enabled) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "panel-btn";
        btn.textContent = bData.text || "Show Article";
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.gap = "6px";
        btn.style.width = "auto";
        btn.style.padding = "5px 10px";
        btn.style.fontSize = "0.7rem";
        btn.style.fontWeight = "600";
        btn.style.borderRadius = "4px";
        btn.style.border = "1px solid rgba(255,255,255,0.2)";
        btn.style.background = "rgba(68, 214, 44, 0.25)";
        btn.style.color = "#ffffff";
        btn.style.cursor = "pointer";
        btn.style.pointerEvents = "auto";
        btn.style.transition = "all 0.2s ease";

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const url = (bData.url || "").trim();
          const funcName = (bData.jsFunction || "").trim();

          if (url) {
            try { window.open(url, "_blank", "noopener,noreferrer"); } catch (_) {}
          }

          if (funcName) {
            try {
              let fn = window[funcName];
              if (!fn) fn = window?.viewerConfig?.events?.[funcName];
              if (typeof fn === "function") {
                fn({ hotspotId: h.id, action: bData.text, url: bData.url });
              }
            } catch (_) {}
          }
        });

        btnContainer.appendChild(btn);
      });

      if (btnContainer.children.length > 0) {
        secContainer.appendChild(btnContainer);
      }
    }

    if (secContainer.children.length > 0) {
      children.push(secContainer);
    }
  });

  panel.replaceChildren(...children);
}

export function updateOverlayPositions() {
  if (!state.camera || !state.overlay || !state.hotspots?.length) return;
  const viewportWidth = state.viewport.clientWidth;
  const viewportHeight = state.viewport.clientHeight;

  const panelBg = state.sceneDocument?.settings?.hotspots?.panelColor;

  state.hotspots.forEach((h) => {
    if (!h.position || !h.dot || !h.panel) return;
    if (h.visible === false) {
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      if(h.line) h.line.style.display = "none";
      return;
    }

    const { x, y, inFrustum } = projectToScreen(h.position, state.camera, viewportWidth, viewportHeight);
    
    if(!inFrustum){
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      if(h.line) h.line.style.display = "none";
      return;
    }
    
    h.dot.style.display = "block";
    if(h.line) h.line.style.display = "block";
    h.dot.style.left = `${x}px`;
    h.dot.style.top = `${y}px`;
    
    const panelX = (viewportWidth * 0.5) + (h.panelOffset?.x || 0);
    const panelY = (viewportHeight * 0.5) + (h.panelOffset?.y || 0);
    h.panel.style.left = `${panelX}px`;
    h.panel.style.top = `${panelY}px`;
    
    if (panelBg) h.panel.style.backgroundColor = panelBg;
    
    if(h.line){
      const panelWidth = h.panel.offsetWidth || 220;
      const panelHeight = h.panel.offsetHeight || 60;
      const lineSettings = state.sceneDocument?.settings?.line || {};
      const lineOffset = lineSettings.offset || { x: 0, y: 0 };
      const lineStyle = lineSettings.style || "dashed";
      const lineColor = lineSettings.color || "#44D62C";
      const lineWidth = Number(lineSettings.width || 1.5);
      
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
    }
  });
}

export function clearHotspotOverlays() {
  if (state.overlay) {
    state.overlay.querySelectorAll(".hotspot, .panel").forEach((el) => el.remove());
  }
  if (state.svgOverlay) {
    state.svgOverlay.innerHTML = '';
  }
  state.hotspots = [];
}
