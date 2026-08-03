import * as THREE from "three";

import { state } from "../state/state.js";
import { buildHotspot, removeHotspot } from "../hotspots/hotspots.js";
import { frameModel } from "../render/render.js";

function importModel(loader, file) {

return new Promise(async(resolve)=>{

const url = URL.createObjectURL(file);
const gltf = await loader.loadAsync(url);

if(state.currentModel){
state.scene.remove(state.currentModel);
}

state.currentModel = gltf.scene;
state.scene.add(state.currentModel);

state.currentModel.traverse((obj)=>{
if(obj.isMesh && obj.material){
obj.material.envMapIntensity = 2.5;
}
});

frameModel(state.currentModel);

resolve(state.currentModel);

});

}

function importJson(file){

return new Promise(async(resolve)=>{

state.importedJsonFileName = file.name;
const text = await file.text();
const data = JSON.parse(text);

if(data.scene){
Object.assign(state.sceneSettings, data.scene);

if(state.sceneSettings.background){
state.scene.background = new THREE.Color(state.sceneSettings.background);

document.getElementById("backgroundColor").value = state.sceneSettings.background;
}
}

state.hotspots.forEach((h)=>{
removeHotspot(h);
});

state.hotspots.length = 0;

data.hotspots.forEach((h)=>{
const hotspot = {
id:h.id,
title:h.title,
description:h.description,
position:h.position,
panelOffset:h.panelOffset || {x:250,y:-120}
};
state.hotspots.push(hotspot);
buildHotspot(hotspot);
});

resolve(data);

});

}

function exportJson(){

const exportData = {
scene:state.sceneSettings,
settings:{},
hotspots:state.hotspots.map((h)=>({
id:h.id,
title:h.title,
description:h.description,
position:h.position,
panelOffset:h.panelOffset
}))
};

const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:"application/json"});
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = state.importedJsonFileName;
a.click();

}

function bindIO(loader){

document.getElementById("importJsonBtn").onclick = ()=>{
document.getElementById("jsonInput").click();
};

document.getElementById("jsonInput").addEventListener("change", async(e)=>{
const file = e.target.files[0];
if(!file) return;
await importJson(file);
});

document.getElementById("exportBtn").onclick = ()=>{
exportJson();
};

document.getElementById("modelInput").addEventListener("change", async(e)=>{
const file = e.target.files[0];
if(!file) return;
await importModel(loader, file);
});
}

export {
bindIO,
exportJson,
importJson,
importModel
};
