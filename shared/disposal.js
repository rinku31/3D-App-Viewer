/**
 * Shared Three.js Resource Disposal Utility
 * 
 * Safely disposes meshes, geometries, materials, textures, render targets,
 * PMREM textures, and light objects to prevent WebGL GPU memory leaks.
 */

import * as THREE from "three";

/**
 * Recursively disposes all geometry, materials, and textures within a Three.js Object3D hierarchy.
 * @param {THREE.Object3D} object - Root object to dispose
 * @param {boolean} removeFromParent - Whether to remove object from its parent
 */
export function disposeHierarchy(object, removeFromParent = true) {
  if (!object) return;

  object.traverse((child) => {
    // 1. Dispose Geometry
    if (child.geometry) {
      child.geometry.dispose();
    }

    // 2. Dispose Materials & Material Textures
    if (child.material) {
      disposeMaterial(child.material);
    }

    // 3. Dispose Light shadow maps
    if (child.isLight && child.shadow?.map) {
      child.shadow.map.dispose();
    }
  });

  if (removeFromParent && object.parent) {
    object.parent.remove(object);
  }
}

/**
 * Disposes a material or an array of materials and all associated textures.
 * @param {THREE.Material | THREE.Material[]} material 
 */
export function disposeMaterial(material) {
  if (!material) return;

  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  // Iterate over material texture properties
  const textureKeys = [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "displacementMap",
    "emissiveMap",
    "envMap",
    "lightMap",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
    "specularMap",
    "gradientMap",
    "clearcoatMap",
    "clearcoatNormalMap",
    "clearcoatRoughnessMap",
    "transmissionMap",
    "thicknessMap",
    "sheenColorMap",
    "sheenRoughnessMap",
    "iridescenceMap",
    "iridescenceThicknessMap"
  ];

  textureKeys.forEach((key) => {
    const tex = material[key];
    if (tex && typeof tex.dispose === "function") {
      tex.dispose();
    }
  });

  material.dispose();
}

/**
 * Disposes a texture or PMREM texture target.
 * @param {THREE.Texture} texture 
 */
export function disposeTexture(texture) {
  if (texture && typeof texture.dispose === "function") {
    texture.dispose();
  }
}
