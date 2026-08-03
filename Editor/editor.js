import * as THREE from "three";

import { OrbitControls }
from "three/addons/controls/OrbitControls.js";

import { GLTFLoader }
from "three/addons/loaders/GLTFLoader.js";

import { DRACOLoader }
from "three/addons/loaders/DRACOLoader.js";

import { RGBELoader }
from "three/addons/loaders/RGBELoader.js";

const viewport =
document.getElementById("viewport");

const overlay =
document.getElementById("overlay");

const hotspotLines =
document.getElementById("hotspotLines");

const scene =
new THREE.Scene();

scene.background =
new THREE.Color(0x1a1a1a);

const camera =
new THREE.PerspectiveCamera(
45,
viewport.clientWidth / viewport.clientHeight,
0.01,
1000
);

camera.position.set(0,1,4);

const renderer =
new THREE.WebGLRenderer({
antialias:true
});

renderer.setSize(
viewport.clientWidth,
viewport.clientHeight
);

renderer.setPixelRatio(
Math.min(window.devicePixelRatio,1.5)
);

renderer.outputColorSpace =
THREE.SRGBColorSpace;

renderer.toneMapping =
THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.6;

document
.getElementById("backgroundColor")
.addEventListener(
"input",
(e)=>{

sceneSettings.background =
e.target.value;

scene.background =
new THREE.Color(
sceneSettings.background
);

}
);


viewport.appendChild(renderer.domElement);

const controls =
new OrbitControls(
camera,
renderer.domElement
);

controls.enableDamping = true;

controls.minPolarAngle = -Infinity;
controls.maxPolarAngle = Infinity;

controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;

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
pmrem.fromEquirectangular(hdr).texture;

scene.environment = envMap;

scene.background =
new THREE.Color(0x3f3f3f);

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

const raycaster =
new THREE.Raycaster();

const mouse =
new THREE.Vector2();

const hotspots = [];

const lights = [];

let selectedLight = null;

const lightTexture =
new THREE.TextureLoader().load(
"https://threejs.org/examples/textures/sprites/disc.png"
);

let selected = null;

let addMode = false;

let importedJsonFileName = "hotspots.json";

const sceneSettings = {

background:"#3f3f3f",

environment:{
intensity:1.0,
exposure:1.6,
toneMapping:"ACESFilmic",
hdri:"studio_small_09"
}

};

const sidebar =
document.getElementById("sidebar");

const toggleSidebarBtn =
document.getElementById("toggleSidebarBtn");


toggleSidebarBtn.onclick = ()=>{

sidebar.classList.toggle("hidden");

toggleSidebarBtn.classList.toggle(
"sidebar-hidden"
);

};

document.getElementById("modelInput")
.addEventListener(
"change",
async(e)=>{

const file =
e.target.files[0];

if(!file) return;

const url =
URL.createObjectURL(file);

const gltf =
await loader.loadAsync(url);

if(currentModel){
scene.remove(currentModel);
}

currentModel = gltf.scene;

scene.add(currentModel);

currentModel.traverse((obj)=>{
if(obj.isMesh && obj.material){
obj.material.envMapIntensity = 2.5;
}
});

frameModel();

}
);

function frameModel(){

const box =
new THREE.Box3()
.setFromObject(currentModel);

const size =
box.getSize(new THREE.Vector3());

const center =
box.getCenter(new THREE.Vector3());

const maxSize =
Math.max(size.x,size.y,size.z);

camera.position.set(
center.x,
center.y + (maxSize * .35),
center.z + (maxSize * 1.5)
);

//

controls.target.copy(center);

controls.update();

}

document.getElementById("addBtn")
.onclick = ()=>{

addMode = !addMode;

if (addMode) 
document.getElementById("addBtn").textContent = "Cancel";
else 
document.getElementById("addBtn").textContent = "Add Hotspot";


document.getElementById("addBtn").classList.toggle("active");

};

/*
document.getElementById("finalizeBtn")
.onclick = ()=>{

addMode = false;
editMode = false;

};*/


let draggingHotspot = false;

renderer.domElement.addEventListener(
"click",
(e)=>{

if(draggingHotspot) return;

mouse.x =
(e.offsetX / viewport.clientWidth)
* 2 - 1;

mouse.y =
-(e.offsetY / viewport.clientHeight)
* 2 + 1;

raycaster.setFromCamera(mouse,camera);

const lightSprites=
lights.map(l=>l.sprite);

const lightHits=
raycaster.intersectObjects(
lightSprites
);

if(lightHits.length){

const lightData=
lights.find(
l=>l.sprite===
lightHits[0].object
);

selectLight(lightData);

return;

}

const intersects =
currentModel
? raycaster.intersectObject(currentModel,true)
: [];

if(addMode){

// clicked on model
if(intersects.length){

const point = intersects[0].point;

createHotspot(point);

// auto exit add mode
addMode = false;
document.getElementById("addBtn").textContent = "Add Hotspot";
document.getElementById("addBtn").classList.toggle("active");


return;

}

// clicked empty space
addMode = false;
document.getElementById("addBtn").textContent = "Add Hotspot";
document.getElementById("addBtn").classList.toggle("active");

return;

}

if(intersects.length === 0){

deselectHotspot();

}

}
);

function deselectHotspot(){

selected = null;

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

hotspots.push(hotspot);

buildHotspot(hotspot);

selectHotspot(hotspot);

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

overlay.appendChild(dot);

makeHotspotDraggable(dot,h);

const line = document.createElementNS("http://www.w3.org/2000/svg","line");
hotspotLines.appendChild(line);

const panel =
document.createElement("div");

panel.className = "panel";

updatePanelHTML(h,panel);

overlay.appendChild(panel);

makePanelDraggable(panel,h);

h.dot = dot;
h.panel = panel;
h.line = line;

}

function updatePanelHTML(h,panel){

panel.innerHTML = `
<div style="
font-weight:bold;
margin-bottom:8px;
">
${h.title}
</div>

<div>
${h.description}
</div>
`;

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

mouse.x =
(e.clientX / viewport.clientWidth)
* 2 - 1;

mouse.y =
-(e.clientY / viewport.clientHeight)
* 2 + 1;

raycaster.setFromCamera(mouse,camera);

const intersects =
raycaster.intersectObject(
currentModel,
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

draggingHotspot = false;

controls.enabled = true;

}

}
);

dot.addEventListener(
"mousedown",
(e)=>{

if(selected !== hotspot)
return;

e.stopPropagation();

dragging = true;

draggingHotspot = true;

controls.enabled = false;

}
);

}

function selectHotspot(h){

selected = h;

document.querySelectorAll(
".hotspot"
).forEach((el)=>{
el.classList.remove("selected");
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

document.getElementById(
"titleInput"
).addEventListener(
"input",
(e)=>{

if(!selected) return;

selected.title =
e.target.value;

updatePanelHTML(
selected,
selected.panel
);

}
);

document.getElementById(
"descInput"
).addEventListener(
"input",
(e)=>{

if(!selected) return;

selected.description =
e.target.value;

updatePanelHTML(
selected,
selected.panel
);

}
);

document.getElementById(
"panelX"
).addEventListener(
"input",
(e)=>{

if(!selected) return;

selected.panelOffset.x =
Number(e.target.value);

}
);

document.getElementById(
"panelY"
).addEventListener(
"input",
(e)=>{

if(!selected) return;

selected.panelOffset.y =
Number(e.target.value);

}
);

document.getElementById(
"deleteBtn"
).onclick = ()=>{

if(!selected) return;

selected.dot.remove();
selected.panel.remove();
selected.line?.remove();

const index =
hotspots.indexOf(selected);

if(index !== -1){
hotspots.splice(index,1);
}

selected = null;

};

document.getElementById(
"importJsonBtn"
).onclick = ()=>{

document.getElementById(
"jsonInput"
).click();

};

document.getElementById(
"jsonInput"
).addEventListener(
"change",
async(e)=>{

const file =
e.target.files[0];

if(!file) return;

importedJsonFileName = file.name;

const text =
await file.text();

const data =
JSON.parse(text);

if(data.scene){

Object.assign(
sceneSettings,
data.scene
);

if(sceneSettings.background){

scene.background =
new THREE.Color(
sceneSettings.background
);

document.getElementById(
"backgroundColor"
).value =
sceneSettings.background;

}

}

hotspots.forEach((h)=>{
h.dot.remove();
h.panel.remove();
h.line?.remove();
});

hotspots.length = 0;

data.hotspots.forEach((h)=>{

const hotspot = {

id:h.id,
title:h.title,
description:h.description,
position:h.position,
panelOffset:h.panelOffset || {x:250,y:-120}

};

hotspots.push(hotspot);

buildHotspot(hotspot);

});

}
);

document.getElementById(
"exportBtn"
).onclick = ()=>{

const exportData = {

scene:sceneSettings,

settings:{},

hotspots:
hotspots.map((h)=>({

id:h.id,
title:h.title,
description:h.description,
position:h.position,
panelOffset:h.panelOffset

}))

};

const blob =
new Blob(
[
JSON.stringify(
exportData,
null,
2
)
],
{
type:"application/json"
}
);

const url =
URL.createObjectURL(blob);

const a =
document.createElement("a");

a.href = url;

a.download =
importedJsonFileName;

a.click();

};


function updateHotspots(){

hotspots.forEach((h)=>{

const pos =
new THREE.Vector3(
h.position[0],
h.position[1],
h.position[2]
);

const projected =
pos.clone().project(camera);

// behind camera

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

const hotspotDistance =
camera.position.distanceTo(pos);

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
* viewport.clientWidth;

const y =
(-projected.y * .5 + .5)
* viewport.clientHeight;

h.dot.style.left =
`${x}px`;

h.dot.style.top =
`${y}px`;

const panelX =
(window.innerWidth * .5)
+ h.panelOffset.x;

const panelY =
(window.innerHeight * .5)
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

function createDirectionalLight(){

    const light = new THREE.DirectionalLight(
        0xffffff,
        2
    );

    light.position.set(2,3,2);

    // Default target
    const target = new THREE.Object3D();
    target.position.set(0,0,0);

    scene.add(target);

    light.target = target;

    scene.add(light);

    // ---------- Light Gizmo ----------

    const lightSprite =
    new THREE.Sprite(
        new THREE.SpriteMaterial({

            map: lightTexture,

            color: 0xffff00,

            depthTest:false,

            depthWrite:false

        })
    );

    lightSprite.scale.set(
        0.15,
        0.15,
        0.15
    );

    lightSprite.position.copy(
        light.position
    );

    scene.add(lightSprite);

    // ---------- Target Gizmo ----------

    const targetSprite =
    new THREE.Sprite(
        new THREE.SpriteMaterial({

            map: lightTexture,

            color: 0x00ffff,

            depthTest:false,

            depthWrite:false

        })
    );

    targetSprite.scale.set(
        0.12,
        0.12,
        0.12
    );

    targetSprite.position.copy(
        target.position
    );

    scene.add(targetSprite);

    // ---------- Helper ----------

    const helper =
    new THREE.DirectionalLightHelper(
        light,
        0.4
    );

    scene.add(helper);

    // ---------- Connection Line ----------

    const lineGeometry =
    new THREE.BufferGeometry().setFromPoints([

        light.position.clone(),

        target.position.clone()

    ]);

    const line =
    new THREE.Line(

        lineGeometry,

        new THREE.LineBasicMaterial({

            color:0xffffff

        })

    );

    scene.add(line);

    const lightData={

        id:
        "light_"+Date.now(),

        type:"directional",

        light,

        helper,

        target,

        lightSprite,

        targetSprite,

        line,

        color:"#ffffff",

        intensity:2,

        castShadow:false

    };

    lights.push(lightData);

    selectLight(lightData);

}

function selectLight(lightData){

    selectedLight = lightData;

    lights.forEach(l=>{

        l.lightSprite.material.color.set(
            0xffff00
        );

        l.targetSprite.material.color.set(
            0x00ffff
        );

    });

    lightData.lightSprite.material.color.set(
        0x00ff00
    );

    lightData.targetSprite.material.color.set(
        0xff0000
    );

    document.getElementById("lightColor").value =
    lightData.color;

    document.getElementById("lightIntensity").value =
    lightData.intensity;

    document.getElementById("lightPosX").value =
    lightData.light.position.x.toFixed(2);

    document.getElementById("lightPosY").value =
    lightData.light.position.y.toFixed(2);

    document.getElementById("lightPosZ").value =
    lightData.light.position.z.toFixed(2);

    document.getElementById("targetPosX").value =
    lightData.target.position.x.toFixed(2);

    document.getElementById("targetPosY").value =
    lightData.target.position.y.toFixed(2);

    document.getElementById("targetPosZ").value =
    lightData.target.position.z.toFixed(2);

    document.getElementById("castShadow").checked =
    lightData.castShadow;

}

document
.getElementById(
"addDirectionalLightBtn"
)
.onclick=()=>{

createDirectionalLight();

};

document
.getElementById(
"deleteLightBtn"
)
.onclick=()=>{

if(!selectedLight)
return;

scene.remove(
selectedLight.light
);

scene.remove(
selectedLight.sprite
);

const index=
lights.indexOf(
selectedLight
);

if(index!=-1){

lights.splice(index,1);

}

selectedLight=null;

};

function animate(){

requestAnimationFrame(animate);

controls.update();

updateHotspots();

for(const l of lights){

    l.lightSprite.position.copy(
        l.light.position
    );

    l.targetSprite.position.copy(
        l.target.position
    );

    l.helper.update();

    l.line.geometry.setFromPoints([

        l.light.position,

        l.target.position

    ]);

}

renderer.render(scene,camera);

}

function UpdateCamera(){

}

function updateSelectedLight(){

    if(!selectedLight) return;

    selectedLight.color =
    document.getElementById("lightColor").value;

    selectedLight.intensity =
    parseFloat(
        document.getElementById("lightIntensity").value
    );

    selectedLight.light.color.set(
        selectedLight.color
    );

    selectedLight.light.intensity =
    selectedLight.intensity;

    selectedLight.light.position.set(

        parseFloat(document.getElementById("lightPosX").value),

        parseFloat(document.getElementById("lightPosY").value),

        parseFloat(document.getElementById("lightPosZ").value)

    );

    selectedLight.target.position.set(

        parseFloat(document.getElementById("targetPosX").value),

        parseFloat(document.getElementById("targetPosY").value),

        parseFloat(document.getElementById("targetPosZ").value)

    );

    selectedLight.castShadow =
    document.getElementById("castShadow").checked;

    selectedLight.light.castShadow =
    selectedLight.castShadow;

}

animate();

window.addEventListener(
"resize",
()=>{

camera.aspect =
viewport.clientWidth /
viewport.clientHeight;

camera.updateProjectionMatrix();

renderer.setSize(
viewport.clientWidth,
viewport.clientHeight
);

}
);

[
"lightColor",
"lightIntensity",
"lightPosX",
"lightPosY",
"lightPosZ",
"targetPosX",
"targetPosY",
"targetPosZ",
"castShadow"

].forEach(id=>{

document
.getElementById(id)
.addEventListener(
"input",
updateSelectedLight
);

});