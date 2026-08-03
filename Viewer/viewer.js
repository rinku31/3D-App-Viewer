import * as THREE from "three";

import { OrbitControls }
from "three/addons/controls/OrbitControls.js";

import { GLTFLoader }
from "three/addons/loaders/GLTFLoader.js";

import { DRACOLoader }
from "three/addons/loaders/DRACOLoader.js";

import { RGBELoader }
from "three/addons/loaders/RGBELoader.js";

const raycaster =
new THREE.Raycaster();

const overlay =
document.getElementById("overlay");

const svg =
document.getElementById("svg");

function setPanelContent(panel, hotspot){

const title = document.createElement("div");
title.style.fontWeight = "bold";
title.style.marginBottom = "8px";
title.textContent = hotspot.title;

const description = document.createElement("div");
description.textContent = hotspot.description;

panel.replaceChildren(title, description);

}

const scene =
new THREE.Scene();

scene.background =
new THREE.Color(0xffffff);

const camera =
new THREE.PerspectiveCamera(
45,
window.innerWidth/window.innerHeight,
0.01,
1000
);

camera.position.set(0,1,4);

const renderer =
new THREE.WebGLRenderer({
antialias:true,
powerPreference:"high-performance"
});

const QUALITY_SCALE = 0.8;

renderer.setSize(
window.innerWidth * QUALITY_SCALE,
window.innerHeight * QUALITY_SCALE,
false
);

renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.imageRendering =
"auto";

renderer.setPixelRatio(1);

renderer.outputColorSpace =
THREE.SRGBColorSpace;

renderer.toneMapping =
THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.6;

document.body.appendChild(
renderer.domElement
);

const controls =
new OrbitControls(
camera,
renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.09;

scene.add(
new THREE.AmbientLight(
0xffffff,
0.7
)
);

const light =
new THREE.DirectionalLight(
0xffffff,
2
);

light.position.set(5,10,5);

scene.add(light);

const pmrem =
new THREE.PMREMGenerator(renderer);

new RGBELoader().load(
"https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr",
(hdr)=>{

const envMap =
pmrem.fromEquirectangular(hdr)
.texture;

scene.environment = envMap;

scene.background =
new THREE.Color(0xffffff);

}
);

const draco =
new DRACOLoader();

draco.setDecoderPath(
"https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/"
);

const loader =
new GLTFLoader();

loader.setDRACOLoader(draco);

let currentModel = null;
let hotspotData = null;

// throttled visibility system

let visibilityDirty = true;

let lastVisibilityUpdate = 0;

const VISIBILITY_INTERVAL = 220;

controls.addEventListener(
"change",
()=>{
visibilityDirty = true;
}
);

function updateVisibility(){

if(!hotspotData || !currentModel)
return;

hotspotData.hotspots.forEach((h)=>{

const pos =
new THREE.Vector3(
h.position[0],
h.position[1],
h.position[2]
);

// behind camera

const projected =
pos.clone().project(camera);

if(
projected.z > 1 ||
projected.z < -1
){

h.visible = false;
return;

}

const direction =
pos.clone()
.sub(camera.position)
.normalize();

raycaster.set(
camera.position,
direction
);

const intersects =
raycaster.intersectObject(
currentModel,
true
);

if(!intersects.length){

h.visible = true;
return;

}

const hitDistance =
intersects[0].distance;

const hotspotDistance =
camera.position.distanceTo(pos);

h.visible =
hotspotDistance <=
hitDistance + 0.01;

});

}

function buildHotspots(){

overlay.querySelectorAll(
".hotspot,.panel"
).forEach(el=>el.remove());

svg.innerHTML = "";

if(!hotspotData?.hotspots)
return;

hotspotData.hotspots.forEach((h)=>{

const dot =
document.createElement("div");

dot.className = "hotspot";

const panel =
document.createElement("div");

panel.className = "panel";

setPanelContent(panel, h);

const line =
document.createElementNS(
"http://www.w3.org/2000/svg",
"line"
);

line.style.display = "none";

dot.addEventListener(
"mouseenter",
()=>{

panel.style.display = "block";
line.style.display = "block";

}
);

dot.addEventListener(
"mouseleave",
()=>{

panel.style.display = "none";
line.style.display = "none";

}
);

overlay.appendChild(dot);
overlay.appendChild(panel);
svg.appendChild(line);

h.dot = dot;
h.panel = panel;
h.line = line;
h.visible = true;

});

visibilityDirty = true;

}

document.getElementById(
"modelInput"
).addEventListener(
"change",
async(e)=>{

const file =
e.target.files[0];

if(!file) return;

const gltf =
await loader.loadAsync(
URL.createObjectURL(file)
);

if(currentModel){

scene.remove(currentModel);

}

currentModel =
gltf.scene;

scene.add(currentModel);

currentModel.traverse((obj)=>{

if(obj.isMesh && obj.material){

obj.material.envMapIntensity = 2.5;

}

});

const box =
new THREE.Box3()
.setFromObject(currentModel);

const size =
box.getSize(
new THREE.Vector3()
);

const center =
box.getCenter(
new THREE.Vector3()
);

const maxSize =
Math.max(size.x,size.y,size.z);

camera.position.set(
center.x,
center.y + maxSize * .35,
center.z + maxSize * 1.5
);

controls.target.copy(center);

controls.update();

const ASSET_BASE = "/Viewer/assets/Products";

const modelName =
file.name.replace(/\.glb$/i,"");

const jsonPath =
`${ASSET_BASE}/${modelName}.json`;

try{

const response =
await fetch(jsonPath);

if(response.ok){

hotspotData =
await response.json();

buildHotspots();

if(hotspotData?.model?.rotation){

currentModel.rotation.set(
hotspotData.model.rotation.x || 0,
hotspotData.model.rotation.y || 0,
hotspotData.model.rotation.z || 0
);

}

}

}catch(err){

console.log(err);

}

}
);

function updateHotspots(){

if(!hotspotData)
return;

hotspotData.hotspots.forEach((h)=>{

if(!h.visible){

h.dot.style.display = "none";

h.panel.style.display = "none";

h.line.style.display = "none";

return;

}

h.dot.style.display = "block";

const pos =
new THREE.Vector3(
h.position[0],
h.position[1],
h.position[2]
);

const projected =
pos.clone().project(camera);

const viewportRect = renderer.domElement.getBoundingClientRect();

const x =
viewportRect.left +
((projected.x * .5 + .5)
* viewportRect.width);

const y =
viewportRect.top +
((-projected.y * .5 + .5)
* viewportRect.height);

// transform instead of left/top

h.dot.style.left =
`${x}px`;

h.dot.style.top =
`${y}px`;

const panelX =
viewportRect.left +
(viewportRect.width * .5) +
(h.panelOffset?.x || 0);

const panelY =
viewportRect.top +
(viewportRect.height * .5) +
(h.panelOffset?.y || 0);

h.panel.style.transform =
`translate(${panelX}px,${panelY}px)`;

const lineSettings =
hotspotData.settings?.line || {};

const lineOffset =
lineSettings.offset || {
x:0,
y:0
};

const lineColor =
lineSettings.color || "#ffffff";

const lineWidth =
lineSettings.width || 2;

h.line.setAttribute(
"x1",
x + lineOffset.x
);

h.line.setAttribute(
"y1",
y + lineOffset.y
);

h.line.setAttribute(
"x2",
panelX
);

h.line.setAttribute(
"y2",
panelY + 40
);

h.line.setAttribute(
"stroke",
lineColor
);

h.line.setAttribute(
"stroke-width",
lineWidth
);

});

}

window.addEventListener(
"resize",
()=>{

camera.aspect =
window.innerWidth /
window.innerHeight;

camera.updateProjectionMatrix();

renderer.setSize(
window.innerWidth * QUALITY_SCALE,
window.innerHeight * QUALITY_SCALE,
false
);

visibilityDirty = true;

}
);

function animate(){

requestAnimationFrame(
animate
);

controls.update();

const now =
performance.now();

if(
visibilityDirty ||
now - lastVisibilityUpdate >
VISIBILITY_INTERVAL
){

updateVisibility();

lastVisibilityUpdate = now;

visibilityDirty = false;

}

updateHotspots();

renderer.render(
scene,
camera
);

}

animate();
