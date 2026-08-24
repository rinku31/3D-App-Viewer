import { state } from "./state/state.js";
import { initializeRender } from "./render/render.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { initializeEditor } from "./bootstrap/bootstrap.js";

state.viewport = document.getElementById("viewport");
initializeRender();

const dracoPath = new URL("../libs/draco/gltf/", import.meta.url).href;
const draco = new DRACOLoader();
draco.setDecoderPath(dracoPath);
draco.setDecoderConfig({ type: "wasm" });
draco.preload();

const loader = new GLTFLoader();
loader.setCrossOrigin("anonymous");
loader.setDRACOLoader(draco);

initializeEditor(loader);

