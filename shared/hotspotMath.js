/**
 * Shared Hotspot Projection, Occlusion & Math Utilities
 */

import * as THREE from "three";

const _camWorldPos = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _toHotspot = new THREE.Vector3();
const _projected = new THREE.Vector3();
const _direction = new THREE.Vector3();

/**
 * Projects a 3D point into screen coordinates within given viewport bounds.
 * @param {Array<number> | THREE.Vector3} position - [x, y, z] or Vector3
 * @param {THREE.Camera} camera 
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 * @returns {{ x: number, y: number, inFrustum: boolean, depth: number }}
 */
export function projectToScreen(position, camera, width, height) {
  if (Array.isArray(position)) {
    _pos.set(position[0], position[1], position[2]);
  } else {
    _pos.copy(position);
  }

  _projected.copy(_pos).project(camera);

  const inFrustum = _projected.z >= -1 && _projected.z <= 1;
  const x = (_projected.x * 0.5 + 0.5) * width;
  const y = (-_projected.y * 0.5 + 0.5) * height;

  return {
    x,
    y,
    inFrustum,
    depth: _projected.z
  };
}

/**
 * Performs occlusion testing for a hotspot position against model geometry.
 * Returns true if visible, false if occluded or behind camera.
 * 
 * @param {Array<number>} position - [x, y, z] world coordinates
 * @param {THREE.Camera} camera 
 * @param {THREE.Object3D} model 
 * @param {THREE.Raycaster} raycaster 
 * @param {number} tolerance - Epsilon distance tolerance (default 0.08)
 * @returns {boolean}
 */
export function testHotspotOcclusion(position, camera, model, raycaster, tolerance = 0.08) {
  if (!camera || !position) return false;

  camera.getWorldPosition(_camWorldPos);
  camera.getWorldDirection(_camForward);

  _pos.set(position[0], position[1], position[2]);
  _toHotspot.copy(_pos).sub(_camWorldPos);

  // 1. Cull if point is behind camera plane
  if (_toHotspot.dot(_camForward) <= 0) {
    return false;
  }

  // 2. Cull if out of NDC bounds [-1, 1] (off-screen)
  _projected.copy(_pos).project(camera);
  if (
    _projected.z > 1 || _projected.z < -1 ||
    _projected.x > 1.2 || _projected.x < -1.2 ||
    _projected.y > 1.2 || _projected.y < -1.2
  ) {
    return false;
  }

  // 3. Occlusion raycast test
  if (model && raycaster) {
    const hotspotDistance = _camWorldPos.distanceTo(_pos);
    _direction.copy(_toHotspot).normalize();

    raycaster.set(_camWorldPos, _direction);
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length > 0) {
      const hitDistance = intersects[0].distance;
      return hitDistance >= (hotspotDistance - tolerance);
    }
  }

  return true;
}

/**
 * Calculates 2D connector line endpoint positions from hotspot marker to panel
 * @param {number} markerX 
 * @param {number} markerY 
 * @param {number} panelX 
 * @param {number} panelY 
 * @param {{ x: number, y: number }} lineOffset 
 */
export function calculateConnectorLine(markerX, markerY, panelX, panelY, lineOffset = { x: 0, y: 0 }) {
  return {
    x1: markerX + (lineOffset.x || 0),
    y1: markerY + (lineOffset.y || 0),
    x2: panelX,
    y2: panelY + 40
  };
}
