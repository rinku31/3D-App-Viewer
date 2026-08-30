import * as THREE from "three";

import { clearSelection, notifySelectionChanged, setSelection, state } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { updateGizmoAnchorPosition } from "../gizmo/gizmo.js";
import { projectToScreen, testHotspotOcclusion, calculateConnectorLine } from "../../shared/hotspotMath.js";

function createHotspot(point){
  const hotspot = {
    id: "hotspot_" + Date.now(),
    title: "New Hotspot",
    description: "Description",
    listItems: [],
    button: {
      enabled: false,
      text: "Show Article",
      url: "",
      jsFunction: ""
    },
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
                    description: sec.description,
                    position: h.position
                  }
                }, "*");
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

function makePanelDraggable(panel,hotspot){
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  panel.addEventListener("mousedown", (e)=>{
    dragging = true;
    const vpWidth = state.viewport?.clientWidth || window.innerWidth;
    const vpHeight = state.viewport?.clientHeight || window.innerHeight;
    offsetX = e.clientX - ((vpWidth * 0.5) + (hotspot.panelOffset?.x || 0));
    offsetY = e.clientY - ((vpHeight * 0.5) + (hotspot.panelOffset?.y || 0));
    e.stopPropagation();
  });

  window.addEventListener("mousemove", (e)=>{
    if(!dragging) return;
    const vpWidth = state.viewport?.clientWidth || window.innerWidth;
    const vpHeight = state.viewport?.clientHeight || window.innerHeight;
    hotspot.panelOffset.x = (e.clientX - offsetX) - (vpWidth * 0.5);
    hotspot.panelOffset.y = (e.clientY - offsetY) - (vpHeight * 0.5);
    if(state.selected === hotspot){
      notifySelectionChanged();
    }
  });

  window.addEventListener("mouseup", ()=>{
    dragging = false;
  });
}

function makeHotspotDraggable(dot,hotspot){

let dragging = false;

window.addEventListener(
"mousemove",
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
"mouseup",
()=>{

if(dragging){

dragging = false;

state.draggingHotspot = false;

state.controls.enabled = true;

}

}
);

dot.addEventListener(
"mousedown",
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
