import { state } from "./state/state.js";
import { initializeRender } from "./render/render.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { initializeEditor } from "./bootstrap/bootstrap.js";
import { getStoredLoadout, applyLoadout } from "./state/loadout.js";
import { importJsonData } from "./io/io.js";
import { createDefaultEditorCube } from "./model/cube.js";
import { renderHierarchy } from "./hierarchy/hierarchy.js";

state.viewport = document.getElementById("viewport");
initializeRender();

const draco = new DRACOLoader();
draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
draco.preload();

const loader = new GLTFLoader();
loader.setCrossOrigin("anonymous");
loader.setDRACOLoader(draco);

initializeEditor(loader);

// Initialize default Cube scene and object if not already populated
async function loadDefaultEditorScene() {
  createDefaultEditorCube();

  try {
    const candidatePaths = [
      "../Viewer/assets/Products/Cube.json",
      "./Viewer/assets/Products/Cube.json",
      "/Viewer/assets/Products/Cube.json",
      "./assets/Products/Cube.json",
      "/assets/Products/Cube.json"
    ];
    let cubeJson = null;
    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          cubeJson = await res.json();
          if (cubeJson) break;
        }
      } catch (_) {}
    }
    if (cubeJson) {
      await importJsonData(cubeJson, "Cube.json");
    }
  } catch (err) {
    console.warn("[Editor] Failed to fetch default Cube.json:", err);
  }

  // If user has saved a custom startup loadout, apply it over the base settings
  const savedLoadout = getStoredLoadout();
  if (savedLoadout) {
    try {
      applyLoadout(savedLoadout, { syncUI: true, notify: true });
    } catch (err) {
      console.warn("[Editor] Failed to apply startup loadout on initialization:", err);
    }
  }

  renderHierarchy();
}

loadDefaultEditorScene();


