import { state } from "./state/state.js";
import { initializeRender } from "./render/render.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { initializeEditor } from "./bootstrap/bootstrap.js";

state.viewport = document.getElementById("viewport");
initializeRender();

const draco = new DRACOLoader();
draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/");
draco.preload();

const loader = new GLTFLoader();
loader.setCrossOrigin("anonymous");
loader.setDRACOLoader(draco);

initializeEditor(loader);

