import * as THREE from "three";

import { clearSelection, setSelection, state } from "../state/state.js";

const lightTexture =
new THREE.TextureLoader().load(
"https://threejs.org/examples/textures/sprites/disc.png"
);

function createDirectionalLight(){

const light = new THREE.DirectionalLight(
0xffffff,
2
);

light.position.set(2,3,2);

const target = new THREE.Object3D();
target.position.set(0,0,0);

state.scene.add(target);

light.target = target;

state.scene.add(light);

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

state.scene.add(lightSprite);

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

state.scene.add(targetSprite);

const helper =
new THREE.DirectionalLightHelper(
light,
0.4
);

state.scene.add(helper);

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

state.scene.add(line);

const lightData={

id:
"light_" + Date.now(),

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

state.lights.push(lightData);

selectLight(lightData);

return lightData;

}

function selectLight(lightData){

setSelection("light", lightData);

document.querySelectorAll(
".hotspot"
).forEach((el)=>{
el.classList.remove("selected");
});

document.getElementById("titleInput").value = "";
document.getElementById("descInput").value = "";
document.getElementById("panelX").value = "";
document.getElementById("panelY").value = "";

state.lights.forEach(l=>{

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

const lightColorInput = document.getElementById("lightColor");
const lightIntensityInput = document.getElementById("lightIntensity");
const lightPosXInput = document.getElementById("lightPosX");
const lightPosYInput = document.getElementById("lightPosY");
const lightPosZInput = document.getElementById("lightPosZ");
const targetPosXInput = document.getElementById("targetPosX");
const targetPosYInput = document.getElementById("targetPosY");
const targetPosZInput = document.getElementById("targetPosZ");
const castShadowInput = document.getElementById("castShadow");

lightColorInput.value = lightData.color;
lightIntensityInput.value = lightData.intensity;
lightPosXInput.value = lightData.light.position.x.toFixed(2);
lightPosYInput.value = lightData.light.position.y.toFixed(2);
lightPosZInput.value = lightData.light.position.z.toFixed(2);
targetPosXInput.value = lightData.target.position.x.toFixed(2);
targetPosYInput.value = lightData.target.position.y.toFixed(2);
targetPosZInput.value = lightData.target.position.z.toFixed(2);
castShadowInput.checked = lightData.castShadow;

}

function deselectLight(){

clearSelection("light");

state.lights.forEach(l=>{

l.lightSprite.material.color.set(
0xffff00
);

l.targetSprite.material.color.set(
0x00ffff
);

});

}

function deleteSelectedLight(){

if(!state.selectedLight)
return;

const selectedLight = state.selectedLight;

state.scene.remove(selectedLight.light);
state.scene.remove(selectedLight.lightSprite);
state.scene.remove(selectedLight.targetSprite);
state.scene.remove(selectedLight.helper);
state.scene.remove(selectedLight.line);
state.scene.remove(selectedLight.target);

const index = state.lights.indexOf(selectedLight);

if(index !== -1){
state.lights.splice(index,1);
}

deselectLight();

}

function updateLights(){

for(const l of state.lights){

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

}

function updateSelectedLight(){

if(!state.selectedLight) return;

const selectedLight = state.selectedLight;

selectedLight.color = document.getElementById("lightColor").value;
selectedLight.intensity = parseFloat(document.getElementById("lightIntensity").value);

selectedLight.light.color.set(selectedLight.color);
selectedLight.light.intensity = selectedLight.intensity;

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

selectedLight.castShadow = document.getElementById("castShadow").checked;
selectedLight.light.castShadow = selectedLight.castShadow;

}

function bindLightUI(){

document.getElementById("addDirectionalLightBtn").onclick = ()=>{
createDirectionalLight();
};

document.getElementById("deleteLightBtn").onclick = ()=>{
deleteSelectedLight();
};

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

document.getElementById(id).addEventListener("input", updateSelectedLight);
});

}

export {
bindLightUI,
createDirectionalLight,
deleteSelectedLight,
deselectLight,
selectLight,
updateLights,
updateSelectedLight
};
