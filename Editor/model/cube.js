import * as THREE from "three";
import { state } from "../state/state.js";
import { disposeHierarchy } from "../../shared/disposal.js";
import { frameModel } from "../render/render.js";

/**
 * Creates default procedural Cube model in Editor
 */
export function createDefaultEditorCube() {
  if (state.currentModel) {
    disposeHierarchy(state.currentModel, true);
    state.currentModel = null;
  }

  const group = new THREE.Group();
  group.name = "Cube";

  // Create refined Cube geometry (2x2x2) with smooth studio shading
  const cubeGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0, 4, 4, 4);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x2e323b,
    roughness: 0.25,
    metalness: 0.35,
    envMapIntensity: 2.2
  });

  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.name = "Cube_Mesh";
  cubeMesh.castShadow = true;
  cubeMesh.receiveShadow = true;
  group.add(cubeMesh);

  state.currentModel = group;
  state.scene.add(group);

  if (state.cameraRig) {
    state.cameraRig.setCollisionObject(group);
  }

  return group;
}
