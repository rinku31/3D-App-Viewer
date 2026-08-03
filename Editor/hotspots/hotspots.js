import * as THREE from "three";

import { clearSelection, setSelection, state } from "../state/state.js";

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

panel.addEventListener(
"mousedown",
(e)=>{

dragging = true;

offsetX =
e.clientX -
(
(window.innerWidth * .5)
+ hotspot.panelOffset.x
);

offsetY =
e.clientY -
(
(window.innerHeight * .5)
+ hotspot.panelOffset.y
);

e.stopPropagation();

}
);

window.addEventListener(
"mousemove",
(e)=>{

if(!dragging) return;

hotspot.panelOffset.x =
(
e.clientX - offsetX
) - (window.innerWidth * .5);

hotspot.panelOffset.y =
(
e.clientY - offsetY
) - (window.innerHeight * .5);

document.getElementById(
"panelX"
).value =
Math.round(
hotspot.panelOffset.x
);

document.getElementById(
"panelY"
).value =
Math.round(
hotspot.panelOffset.y
);

}
);

window.addEventListener(
"mouseup",
()=>{

dragging = false;

}
);

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

setSelection("hotspot", h);

document.querySelectorAll(
".hotspot"
).forEach((el)=>{
el.classList.remove("selected");
});

state.lights.forEach((l)=>{

l.lightSprite.material.color.set(
0xffff00
);

l.targetSprite.material.color.set(
0x00ffff
);

});

h.dot.classList.add("selected");

document.getElementById(
"titleInput"
).value = h.title;

document.getElementById(
"descInput"
).value = h.description;

document.getElementById(
"panelX"
).value =
h.panelOffset.x;

document.getElementById(
"panelY"
).value =
h.panelOffset.y;

}

function deselectHotspot(){

clearSelection("hotspot");

document.querySelectorAll(
".hotspot"
).forEach((el)=>{
el.classList.remove("selected");
});

document.getElementById("titleInput").value = "";
document.getElementById("descInput").value = "";
document.getElementById("panelX").value = "";
document.getElementById("panelY").value = "";

}

function updateHotspots(){

state.hotspots.forEach((h)=>{

const pos =
new THREE.Vector3(
h.position[0],
h.position[1],
h.position[2]
);

const projected =
pos.clone().project(state.camera);

if(projected.z > 1){

h.dot.style.display = "none";
h.panel.style.display = "none";

if(h.line){
h.line.style.display = "none";
}

return;

}

const direction =
pos.clone()
.sub(state.camera.position)
.normalize();

state.raycaster.set(
state.camera.position,
direction
);

const intersects =
state.raycaster.intersectObject(
state.currentModel,
true
);

const hotspotDistance =
state.camera.position.distanceTo(pos);

let visible = true;

if(intersects.length){

visible =
intersects[0].distance >=
hotspotDistance - 0.03;

}

if(!visible){

h.dot.style.display = "none";
h.panel.style.display = "none";

if(h.line){
h.line.style.display = "none";
}

return;

}

h.dot.style.display = "block";
h.panel.style.display = "block";

if(h.line){
h.line.style.display = "block";
}

const x =
(projected.x * .5 + .5)
* state.viewport.clientWidth;

const y =
(-projected.y * .5 + .5)
* state.viewport.clientHeight;

h.dot.style.left =
`${x}px`;

h.dot.style.top =
`${y}px`;

const panelX =
(state.viewport.clientWidth * .5)
+ h.panelOffset.x;

const panelY =
(state.viewport.clientHeight * .5)
+ h.panelOffset.y;

h.panel.style.left =
`${panelX}px`;

h.panel.style.top =
`${panelY}px`;

if(h.line){

h.line.setAttribute("x1",x);
h.line.setAttribute("y1",y);
h.line.setAttribute("x2",panelX);
h.line.setAttribute("y2",panelY + 40);

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
