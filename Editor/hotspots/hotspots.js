import * as THREE from "three";

import { clearSelection, notifySelectionChanged, setSelection, state } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { updateGizmoAnchorPosition } from "../gizmo/gizmo.js";
import { projectToScreen, testHotspotOcclusion, calculateConnectorLine } from "../../shared/hotspotMath.js";

function createHotspot(point){

const hotspot = {

id:
"hotspot_" + Date.now(),

title:"New Hotspot",

description:"Description",

position:[
point.x,
point.y,
point.z
],

panelOffset:{
x:250,
y:-120
}

};

state.hotspots.push(hotspot);

buildHotspot(hotspot);

selectHotspot(hotspot);

return hotspot;

}

function buildHotspot(h){

const dot =
document.createElement("div");

dot.className = "hotspot";

dot.addEventListener(
"click",
(e)=>{

e.stopPropagation();

selectHotspot(h);

}
);

state.overlay.appendChild(dot);

makeHotspotDraggable(dot,h);

const line = document.createElementNS("http://www.w3.org/2000/svg","line");
state.hotspotLines.appendChild(line);

const panel =
document.createElement("div");

panel.className = "panel";

updatePanelHTML(h,panel);

state.overlay.appendChild(panel);

makePanelDraggable(panel,h);

h.dot = dot;
h.panel = panel;
h.line = line;

}

function updatePanelHTML(h,panel){

const title = document.createElement("div");
title.style.fontWeight = "bold";
title.style.marginBottom = "8px";
title.textContent = h.title;

const description = document.createElement("div");
description.textContent = h.description;

panel.replaceChildren(title, description);

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

    if(h.line){
      const coords = calculateConnectorLine(x, y, panelX, panelY);
      h.line.setAttribute("x1", coords.x1);
      h.line.setAttribute("y1", coords.y1);
      h.line.setAttribute("x2", coords.x2);
      h.line.setAttribute("y2", coords.y2);
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
