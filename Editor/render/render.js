import * as THREE from "three";

import { OrbitControls }
from "three/addons/controls/OrbitControls.js";

import { RGBELoader }
from "three/addons/loaders/RGBELoader.js";

import { state } from "../state/state.js";

function initializeRender(){

const viewport = state.viewport;

const scene =
state.scene =
state.scene ||
new THREE.Scene();

scene.background =
new THREE.Color(0x1a1a1a);

const camera =
state.camera =
state.camera ||
new THREE.PerspectiveCamera(
45,
viewport.clientWidth / viewport.clientHeight,
0.01,
1000
);

camera.position.set(0,1,4);

const renderer =
state.renderer =
state.renderer ||
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

viewport.appendChild(renderer.domElement);

const controls =
state.controls =
state.controls ||
new OrbitControls(
camera,
renderer.domElement
);

controls.enableDamping = true;

controls.minPolarAngle = -Infinity;
controls.maxPolarAngle = Infinity;

controls.minAzimuthAngle = -Infinity;
controls.maxAzimuthAngle = Infinity;

const ambientLight = new THREE.AmbientLight(
0xffffff,
0.7
);
scene.add(ambientLight);
state.defaultAmbientLight = ambientLight;

const light =
new THREE.DirectionalLight(
0xffffff,
2
);

light.position.set(5,10,5);

scene.add(light);
state.defaultDirectionalLight = light;

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

return {
scene,
camera,
renderer,
controls
};

}

function frameModel(model = state.currentModel){

if(!model) return;

const box =
new THREE.Box3()
.setFromObject(model);

const size =
box.getSize(new THREE.Vector3());

const center =
box.getCenter(new THREE.Vector3());

const maxSize =
Math.max(size.x,size.y,size.z);

const camera = state.camera;

camera.position.set(
center.x,
center.y + (maxSize * .35),
center.z + (maxSize * 1.5)
);

const controls = state.controls;

controls.target.copy(center);
controls.update();

}

function resizeRenderer(){

const viewport = state.viewport;
const camera = state.camera;
const renderer = state.renderer;

if(!viewport || !camera || !renderer) return;

camera.aspect =
viewport.clientWidth /
viewport.clientHeight;

camera.updateProjectionMatrix();

renderer.setSize(
viewport.clientWidth,
viewport.clientHeight
);

}

function startAnimation(onFrame){

const step = ()=>{

const controls = state.controls;

if(controls) controls.update();

if(typeof onFrame === "function") onFrame();

const renderer = state.renderer;
const scene = state.scene;
const camera = state.camera;

if(renderer && scene && camera){
renderer.render(scene,camera);
}

requestAnimationFrame(step);

};

requestAnimationFrame(step);

}

export {
initializeRender,
frameModel,
resizeRenderer,
startAnimation
};
