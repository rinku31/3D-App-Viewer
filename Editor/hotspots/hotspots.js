import * as THREE from "three";

import { clearSelection, notifySelectionChanged, setSelection, state } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { updateGizmoAnchorPosition } from "../gizmo/gizmo.js";
import { projectToScreen, testHotspotOcclusion, calculateConnectorLine } from "../../shared/hotspotMath.js";

function createHotspot(point){
  const hotspot = {
    id: "hotspot_" + Date.now(),
    title: "New Hotspot",
    description: "",
    sections: [
      {
        id: "sec_" + Date.now(),
        title: "",
        description: "Hotspot description and overview.",
        listItems: ["Key feature highlight 1", "Key feature highlight 2"],
        buttons: [
          {
            enabled: true,
            text: "Learn More",
            url: "",
            jsFunction: ""
          }
        ]
      }
    ],
    position: [
      point.x,
      point.y,
      point.z
    ],
    panelOffset: {
      x: 250,
      y: -120
    }
  };

  state.hotspots.push(hotspot);
  buildHotspot(hotspot);
  selectHotspot(hotspot);
  return hotspot;
}

function buildHotspot(h){
  const dot = document.createElement("div");
  dot.className = "hotspot";

  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    if (h.locked) return;
    selectHotspot(h);
  });

  // Completely remove and prevent double click actions on hotspot dot
  dot.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  state.overlay.appendChild(dot);
  makeHotspotDraggable(dot, h);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  state.hotspotLines.appendChild(line);

  const panel = document.createElement("div");
  panel.className = "panel";

  // Completely remove and prevent double click actions on hotspot panel
  panel.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  updatePanelHTML(h, panel);

  state.overlay.appendChild(panel);
  makePanelDraggable(panel, h);

  h.dot = dot;
  h.panel = panel;
  h.line = line;
}

function updatePanelHTML(h, panel){
  const children = [];

  const titleFontColor = state.sceneSettings?.hotspots?.titleFontColor || "#ffffff";
  const titleFontSize = Number(state.sceneSettings?.hotspots?.titleFontSize || 14);
  const descFontColor = state.sceneSettings?.hotspots?.descFontColor || "#e0e0e0";
  const descFontSize = Number(state.sceneSettings?.hotspots?.descFontSize || 12.5);
  const listFontColor = state.sceneSettings?.hotspots?.listFontColor || "#cccccc";
  const listFontSize = Number(state.sceneSettings?.hotspots?.listFontSize || 11);
  const btnBgColor = state.sceneSettings?.hotspots?.btnBgColor || "rgba(68, 214, 44, 0.28)";
  const btnFontColor = state.sceneSettings?.hotspots?.btnFontColor || "#ffffff";
  const btnFontSize = Number(state.sceneSettings?.hotspots?.btnFontSize || 11);
  const btnPaddingV = Number(state.sceneSettings?.hotspots?.btnPaddingV || 5);
  const btnPaddingH = Number(state.sceneSettings?.hotspots?.btnPaddingH || 12);
  const btnMargin = Number(state.sceneSettings?.hotspots?.btnMargin || 5);

  // Main Hotspot Title
  if (h.title) {
    const title = document.createElement("div");
    title.className = "panel-title";
    title.style.fontWeight = "bold";
    title.style.fontSize = `${titleFontSize}px`;
    title.style.color = titleFontColor;
    title.style.marginBottom = "6px";
    title.textContent = h.title || "";
    children.push(title);
  }

  // Get paragraphs list
  const paragraphs = Array.isArray(h.paragraphs) ? h.paragraphs : (Array.isArray(h.sections) ? h.sections : []);

  // Top-level description fallback if no paragraphs exist
  if (paragraphs.length === 0 && h.description) {
    const description = document.createElement("div");
    description.className = "panel-desc";
    description.style.fontSize = `${descFontSize}px`;
    description.style.color = descFontColor;
    description.style.marginBottom = "4px";
    description.style.lineHeight = "1.45";
    description.textContent = h.description;
    children.push(description);
  }

  // Render Paragraphs smoothly without horizontal lines
  if (paragraphs.length > 0) {
    paragraphs.forEach((para, pIdx) => {
      const paraContainer = document.createElement("div");
      paraContainer.className = "panel-paragraph";
      paraContainer.style.border = "none";
      if (pIdx > 0 || (children.length > 0 && (para.text || para.description))) {
        paraContainer.style.marginTop = "6px";
      }

      // Paragraph Text
      const text = para.text !== undefined ? para.text : (para.description !== undefined ? para.description : "");
      if (text) {
        const paraText = document.createElement("div");
        paraText.className = "panel-desc";
        paraText.style.fontSize = `${descFontSize}px`;
        paraText.style.color = descFontColor;
        paraText.style.lineHeight = "1.45";
        paraText.style.marginBottom = "4px";
        paraText.textContent = text;
        paraContainer.appendChild(paraText);
      }

      // Paragraph List items
      const rawList = Array.isArray(para.listItems) ? para.listItems : (Array.isArray(para.items) ? para.items : []);
      const validItems = rawList.map((item) => String(item || "").trim()).filter(Boolean);

      if (validItems.length > 0) {
        const ul = document.createElement("ul");
        ul.className = "panel-list";
        ul.style.margin = "4px 0 0 0";
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
          li.style.fontSize = `${listFontSize}px`;
          li.style.color = listFontColor;
          li.style.lineHeight = "1.4";
          li.textContent = itemText;
          ul.appendChild(li);
        });

        paraContainer.appendChild(ul);
      }

      // Paragraph Action Buttons
      const buttons = Array.isArray(para.buttons) ? para.buttons : (para.button ? [para.button] : []);
      const enabledButtons = buttons.filter((b) => b && b.enabled !== false);

      if (enabledButtons.length > 0) {
        const btnGroup = document.createElement("div");
        btnGroup.className = "panel-btn-group";
        btnGroup.style.display = "flex";
        btnGroup.style.flexDirection = "column";
        btnGroup.style.alignItems = "flex-end";
        btnGroup.style.gap = `${btnMargin}px`;
        btnGroup.style.marginTop = `${btnMargin}px`;

        enabledButtons.forEach((btnData) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "panel-btn";
          btn.textContent = btnData.text || "Action";
          btn.style.display = "inline-flex";
          btn.style.alignSelf = "flex-end";
          btn.style.alignItems = "center";
          btn.style.justifyContent = "center";
          btn.style.gap = "5px";
          btn.style.width = "auto";
          btn.style.padding = `${btnPaddingV}px ${btnPaddingH}px`;
          btn.style.fontSize = `${btnFontSize}px`;
          btn.style.fontWeight = "600";
          btn.style.borderRadius = "5px";
          btn.style.border = "1px solid rgba(255,255,255,0.18)";
          btn.style.background = btnBgColor;
          btn.style.color = btnFontColor;
          btn.style.whiteSpace = "nowrap";
          btn.style.cursor = "pointer";
          btn.style.pointerEvents = "auto";
          btn.style.transition = "all 0.2s ease";

          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const url = (btnData.url || "").trim();
            const funcName = (btnData.jsFunction || "").trim();

            if (url) {
              try {
                window.open(url, "_blank", "noopener,noreferrer");
              } catch (_) {}
            }

            if (funcName) {
              try {
                if (window.parent && typeof window.parent[funcName] === "function") {
                  window.parent[funcName](h, btnData);
                } else if (typeof window[funcName] === "function") {
                  window[funcName](h, btnData);
                }

                if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                    type: "HOTSPOT_BUTTON_CLICK",
                    functionName: funcName,
                    button: {
                      text: btnData.text,
                      url: btnData.url,
                      jsFunction: btnData.jsFunction
                    },
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

          btnGroup.appendChild(btn);
        });

        paraContainer.appendChild(btnGroup);
      }

      children.push(paraContainer);
    });
  } else {
    // Legacy single-section rendering if no sections defined
    const rawItems = Array.isArray(h.listItems) ? h.listItems : (Array.isArray(h.items) ? h.items : []);
    const validItems = rawItems.map((item) => String(item || "").trim()).filter(Boolean);

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
        li.style.fontSize = `${listFontSize}px`;
        li.style.color = listFontColor;
        li.style.lineHeight = "1.4";
        li.textContent = itemText;
        ul.appendChild(li);
      });

      children.push(ul);
    }

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
  }

  panel.replaceChildren(...children);
}

function makePanelDraggable(panel,hotspot){
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  panel.addEventListener("pointerdown", (e)=>{
    dragging = true;
    panel.setPointerCapture(e.pointerId);
    const vpWidth = state.viewport?.clientWidth || window.innerWidth;
    const vpHeight = state.viewport?.clientHeight || window.innerHeight;
    offsetX = e.clientX - ((vpWidth * 0.5) + (hotspot.panelOffset?.x || 0));
    offsetY = e.clientY - ((vpHeight * 0.5) + (hotspot.panelOffset?.y || 0));
    e.stopPropagation();
  });

  window.addEventListener("pointermove", (e)=>{
    if(!dragging) return;
    const vpWidth = state.viewport?.clientWidth || window.innerWidth;
    const vpHeight = state.viewport?.clientHeight || window.innerHeight;
    hotspot.panelOffset.x = (e.clientX - offsetX) - (vpWidth * 0.5);
    hotspot.panelOffset.y = (e.clientY - offsetY) - (vpHeight * 0.5);
    if(state.selected === hotspot){
      notifySelectionChanged();
    }
  });

  window.addEventListener("pointerup", (e)=>{
    if(dragging) {
      dragging = false;
      try { panel.releasePointerCapture(e.pointerId); } catch(err) {}
    }
  });
}

function makeHotspotDraggable(dot,hotspot){

let dragging = false;

window.addEventListener(
"pointermove",
(e)=>{

if(!dragging) return;

const viewportRect = state.viewport.getBoundingClientRect();

state.mouse.x =
((e.clientX - viewportRect.left) / viewportRect.width)
* 2 - 1;

state.mouse.y =
-((e.clientY - viewportRect.top) / viewportRect.height)
* 2 + 1;

state.raycaster.setFromCamera(state.mouse,state.camera);

const intersects =
state.raycaster.intersectObject(
state.currentModel,
true
);

if(intersects.length){

const point = intersects[0].point;

hotspot.position = [
point.x,
point.y,
point.z
];

updateGizmoAnchorPosition(point.x, point.y, point.z);
notifySelectionChanged();

}

}
);

window.addEventListener(
"pointerup",
()=>{

if(dragging){

dragging = false;

state.draggingHotspot = false;

state.controls.enabled = true;

}

}
);

dot.addEventListener(
"pointerdown",
(e)=>{

if (hotspot.locked) return;

if(state.selected !== hotspot)
return;

e.stopPropagation();

dragging = true;

state.draggingHotspot = true;

state.controls.enabled = false;

}
);

}

function selectHotspot(h){
select("hotspot", h);
}

function deselectHotspot(){
deselect("hotspot");
}

function updateHotspots(){
  if (!state.camera || !state.viewport || !state.hotspots) return;

  const viewportWidth = state.viewport.clientWidth;
  const viewportHeight = state.viewport.clientHeight;

  state.hotspots.forEach((h)=>{
    if (!h.position || !h.dot || !h.panel) return;

    if (h.visible === false) {
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      if(h.line) h.line.style.display = "none";
      return;
    }

    // 1. Occlusion & camera plane test
    const isVisible = testHotspotOcclusion(
      h.position,
      state.camera,
      state.currentModel,
      state.raycaster,
      0.08
    );

    if(!isVisible){
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      if(h.line) h.line.style.display = "none";
      return;
    }

    // 2. Project to screen
    const { x, y, inFrustum } = projectToScreen(h.position, state.camera, viewportWidth, viewportHeight);

    if(!inFrustum){
      h.dot.style.display = "none";
      h.panel.style.display = "none";
      if(h.line) h.line.style.display = "none";
      return;
    }

    h.dot.style.display = "block";
    h.panel.style.display = "block";
    if(h.line) h.line.style.display = "block";

    h.dot.style.left = `${x}px`;
    h.dot.style.top = `${y}px`;

    const panelX = (viewportWidth * 0.5) + (h.panelOffset?.x || 0);
    const panelY = (viewportHeight * 0.5) + (h.panelOffset?.y || 0);

    h.panel.style.left = `${panelX}px`;
    h.panel.style.top = `${panelY}px`;

    // Apply global panel color if specified
    if (state.sceneSettings?.hotspots?.panelColor) {
      h.panel.style.backgroundColor = state.sceneSettings.hotspots.panelColor;
    }

    if(h.line){
      const panelWidth = h.panel.offsetWidth || 220;
      const panelHeight = h.panel.offsetHeight || 60;
      const lineSettings = state.sceneSettings?.line || {};
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

function removeHotspot(h){

if(!h) return;

h.dot?.remove();
h.panel?.remove();
h.line?.remove();

const index = state.hotspots.indexOf(h);

if(index !== -1){
state.hotspots.splice(index,1);
}

if(state.selected === h){
clearSelection("hotspot");
deselectHotspot();
}

}

export {
createHotspot,
buildHotspot,
updatePanelHTML,
makePanelDraggable,
makeHotspotDraggable,
selectHotspot,
deselectHotspot,
updateHotspots,
removeHotspot
};
