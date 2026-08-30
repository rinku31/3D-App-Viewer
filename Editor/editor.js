import { state } from "./state/state.js";
import { initializeRender } from "./render/render.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { initializeEditor } from "./bootstrap/bootstrap.js";
import { getStoredLoadout, applyLoadout } from "./state/loadout.js";

state.viewport = document.getElementById("viewport");
initializeRender();

const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
draco.preload();

const loader = new GLTFLoader();
loader.setCrossOrigin("anonymous");
loader.setDRACOLoader(draco);

initializeEditor(loader);

// If user has saved a custom startup loadout, apply it upon startup
const savedLoadout = getStoredLoadout();
if (savedLoadout) {
  try {
    applyLoadout(savedLoadout, { syncUI: true, notify: true });
  } catch (err) {
    console.warn("[Editor] Failed to apply startup loadout on initialization:", err);
  }
}

