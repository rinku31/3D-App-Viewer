import * as THREE from "three";

/**
 * CameraRig
 * 
 * Reusable camera orbit rig encapsulating all camera movement.
 * Hierarchy:
 *   Scene -> OrbitYawPivot -> OrbitPitchPivot -> CameraDistancePivot -> Camera
 */
export class CameraRig {
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.domElement = options.domElement || null;
    this.fov = options.fov || 45;
    this.near = options.near || 0.01;
    this.far = options.far || 1000;
    this.aspect = options.aspect || 1;
    this.onChange = options.onChange || null;

    // --- 1. OrbitYawPivot (rotates horizontally around Y axis, infinitely) ---
    this.yawPivot = new THREE.Object3D();
    this.yawPivot.name = "OrbitYawPivot";

    // --- 2. OrbitPitchPivot (child of YawPivot, rotates vertically around X axis, infinitely) ---
    this.pitchPivot = new THREE.Object3D();
    this.pitchPivot.name = "OrbitPitchPivot";
    this.yawPivot.add(this.pitchPivot);

    // --- 3. CameraDistancePivot (child of PitchPivot, offsets camera along local Z) ---
    this.distancePivot = new THREE.Object3D();
    this.distancePivot.name = "CameraDistancePivot";
    this.distance = options.distance || 4;
    this.distancePivot.position.set(0, 0, this.distance);
    this.pitchPivot.add(this.distancePivot);

    // --- 4. Camera (child of DistancePivot, looking down local -Z back at target) ---
    this.camera = new THREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far);
    this.camera.name = "RigCamera";
    this.distancePivot.add(this.camera);

    if (this.scene) {
      this.scene.add(this.yawPivot);
    }

    // Target position (model center or focus point)
    this.target = new THREE.Vector3(0, 0, 0);
    this.currentTarget = this.target.clone();

    // Orbit state
    this.yaw = 0;
    this.pitch = 0.2; // slight downward angle by default
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.targetDistance = this.distance;

    // Speeds & limits
    this.rotateSpeed = 0.005;
    this.zoomSpeed = 0.0015;
    // Strictly bounded to prevent clipping inside models or zooming out to infinity
    this.minDistance = typeof options.minDistance === "number" ? options.minDistance : 1.35;
    this.maxDistance = typeof options.maxDistance === "number" ? options.maxDistance : 16.0;
    this.hasExplicitLimits = typeof options.minDistance === "number" || typeof options.maxDistance === "number";

    // Anti-clipping mesh collision configuration (active in Viewer and Embed)
    this.collisionCheck = Boolean(options.collisionCheck || false);
    this.collisionMargin = typeof options.collisionMargin === "number" ? options.collisionMargin : 0.15;
    this.collisionObject = options.collisionObject || null;
    this._raycaster = new THREE.Raycaster();
    this._rayDir = new THREE.Vector3();
    this._farOrigin = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, "YXZ");
    this._safeDistCache = [];

    // Auto rotate turntable
    this.autoRotate = Boolean(options.autoRotate || false);
    this.autoRotateSpeed = typeof options.autoRotateSpeed === "number" ? options.autoRotateSpeed : 0.016;

    // Damping / smoothness
    this.enableDamping = true;
    this.dampingFactor = 0.12;

    // Interaction controls
    this.enabled = true;
    this.isDragging = false;
    this.pointerStart = { x: 0, y: 0 };
    this.activePointerId = null;

    // Pinch zoom support
    this.touchPinchDist = null;

    // Save initial configuration for reset()
    this.initialState = {
      target: this.target.clone(),
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.distance,
      fov: this.fov,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance
    };

    // Apply initial transforms
    this.applyImmediateTransforms();

    if (this.domElement) {
      this.attachEvents(this.domElement);
    }
  }

  // --- Public API ---

  /**
   * Set the 3D model/mesh object used for anti-clipping collision detection.
   * @param {THREE.Object3D|null} object3D 
   * @param {number|null} [margin]
   */
  setCollisionObject(object3D, margin = null) {
    this.collisionObject = object3D || null;
    this._safeDistCache = [];
    if (typeof margin === "number") {
      this.collisionMargin = margin;
    } else if (object3D && object3D.isObject3D) {
      const box = new THREE.Box3().setFromObject(object3D);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        this.collisionMargin = THREE.MathUtils.clamp(maxDim * 0.04, 0.08, 0.35);
      }
    }
  }

  /**
   * Calculates the minimum collision-free distance from target along given yaw/pitch angles.
   * Uses a fast spatial cache to eliminate duplicate raycasts per frame.
   * @param {number} [yaw]
   * @param {number} [pitch]
   * @returns {number}
   */
  getMinSafeDistance(yaw = this.targetYaw, pitch = this.targetPitch) {
    if (!this.collisionCheck || !this.collisionObject) {
      return this.minDistance;
    }

    const centerPos = this.currentTarget || this.target;

    // Fast cache lookup (tolerance: ~0.25 degrees and 0.0001 distance^2)
    if (this._safeDistCache && this._safeDistCache.length > 0) {
      for (let i = 0; i < this._safeDistCache.length; i++) {
        const entry = this._safeDistCache[i];
        if (
          Math.abs(yaw - entry.yaw) < 0.005 &&
          Math.abs(pitch - entry.pitch) < 0.005 &&
          centerPos.distanceToSquared(entry.center) < 0.0001
        ) {
          return entry.dist;
        }
      }
    }

    this._euler.set(pitch, yaw, 0, "YXZ");
    this._rayDir.set(0, 0, 1).applyEuler(this._euler).normalize();

    const testDist = Math.max(this.maxDistance * 2.0, 50.0);
    this._farOrigin.copy(centerPos).addScaledVector(this._rayDir, testDist);

    // 1. Inward ray from outside the bounding envelope towards target center
    this._raycaster.set(this._farOrigin, this._rayDir.clone().negate());
    this._raycaster.near = 0;
    this._raycaster.far = testDist;

    const hits = this._raycaster.intersectObject(this.collisionObject, true);
    let closestHit = null;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (h.object && h.object.isMesh && h.object.visible) {
        closestHit = h;
        break;
      }
    }

    let calculatedDist = this.minDistance;
    if (closestHit) {
      const surfaceDist = centerPos.distanceTo(closestHit.point);
      calculatedDist = Math.max(this.minDistance, surfaceDist + this.collisionMargin);
    } else {
      // 2. Outward fallback ray from target center
      this._raycaster.set(centerPos, this._rayDir);
      this._raycaster.near = 0;
      this._raycaster.far = testDist;

      const outHits = this._raycaster.intersectObject(this.collisionObject, true);
      let farthestOutHit = null;
      for (let i = 0; i < outHits.length; i++) {
        const h = outHits[i];
        if (h.object && h.object.isMesh && h.object.visible) {
          if (!farthestOutHit || h.distance > farthestOutHit.distance) {
            farthestOutHit = h;
          }
        }
      }

      if (farthestOutHit) {
        calculatedDist = Math.max(this.minDistance, farthestOutHit.distance + this.collisionMargin);
      }
    }

    // Save into multi-entry ring cache
    if (!this._safeDistCache) this._safeDistCache = [];
    if (this._safeDistCache.length >= 6) {
      this._safeDistCache.shift();
    }
    this._safeDistCache.push({
      yaw,
      pitch,
      center: centerPos.clone(),
      dist: calculatedDist
    });

    return calculatedDist;
  }

  /**
   * Rotate horizontally around the target by delta radians.
   */
  rotateYaw(delta) {
    this.targetYaw += delta;
    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Rotate vertically around the target by delta radians.
   */
  rotatePitch(delta) {
    this.targetPitch += delta;
    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Adjust camera distance (zoom) with collision clamping.
   */
  zoom(delta) {
    const factor = Math.exp(delta);
    const minAllowed = this.collisionCheck && this.collisionObject
      ? this.getMinSafeDistance(this.targetYaw, this.targetPitch)
      : this.minDistance;

    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance * factor,
      minAllowed,
      this.maxDistance
    );
    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Focus camera rig on a target point or Object3D model.
   */
  focus(targetObjectOrVec, explicitDistance = null) {
    if (!targetObjectOrVec) return;

    let center = new THREE.Vector3();
    let distance = explicitDistance;

    if (targetObjectOrVec.isVector3) {
      center.copy(targetObjectOrVec);
    } else if (targetObjectOrVec.isObject3D) {
      if (this.collisionCheck) {
        this.setCollisionObject(targetObjectOrVec);
      }

      const box = new THREE.Box3().setFromObject(targetObjectOrVec);
      if (!box.isEmpty()) {
        box.getCenter(center);
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const boundingRadius = maxSize / 2;

        // Ensure minimum distance is strictly outside the outer hull of the model
        if (!this.hasExplicitLimits) {
          this.minDistance = Math.max(0.6, boundingRadius * 1.15);
          this.maxDistance = Math.max(7.0, boundingRadius * 6.5);
          this.initialState.minDistance = this.minDistance;
          this.initialState.maxDistance = this.maxDistance;
        }

        if (distance === null) {
          const fovRad = THREE.MathUtils.degToRad(this.camera.fov / 2);
          distance = (boundingRadius) / Math.tan(fovRad) * 1.45;
          if (distance < this.minDistance) distance = this.minDistance * 1.5;
        }
      } else {
        targetObjectOrVec.getWorldPosition(center);
      }
    }

    this.target.copy(center);
    if (distance !== null && !isNaN(distance)) {
      const minAllowed = this.collisionCheck && this.collisionObject
        ? this.getMinSafeDistance(this.targetYaw, this.targetPitch)
        : this.minDistance;
      this.targetDistance = THREE.MathUtils.clamp(distance, minAllowed, this.maxDistance);
    }

    // Set as new default reference
    this.initialState.target.copy(center);
    if (distance !== null) this.initialState.distance = this.targetDistance;

    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Save a camera state as the canonical default view.
   */
  setDefaultState(savedState) {
    if (!savedState) return;
    if (Array.isArray(savedState.target) && savedState.target.length === 3) {
      this.initialState.target.set(savedState.target[0], savedState.target[1], savedState.target[2]);
    } else if (savedState.target && typeof savedState.target.x === "number") {
      this.initialState.target.copy(savedState.target);
    }
    if (typeof savedState.yaw === "number") this.initialState.yaw = savedState.yaw;
    if (typeof savedState.pitch === "number") this.initialState.pitch = savedState.pitch;
    if (typeof savedState.distance === "number") this.initialState.distance = savedState.distance;
    if (typeof savedState.fov === "number") this.initialState.fov = savedState.fov;
    if (typeof savedState.minDistance === "number") {
      this.initialState.minDistance = savedState.minDistance;
      this.minDistance = savedState.minDistance;
      this.hasExplicitLimits = true;
    }
    if (typeof savedState.maxDistance === "number") {
      this.initialState.maxDistance = savedState.maxDistance;
      this.maxDistance = savedState.maxDistance;
      this.hasExplicitLimits = true;
    }
  }

  /**
   * Get the saved default canonical camera state.
   */
  getDefaultState() {
    return {
      target: [this.initialState.target.x, this.initialState.target.y, this.initialState.target.z],
      yaw: this.initialState.yaw,
      pitch: this.initialState.pitch,
      distance: this.initialState.distance,
      fov: this.initialState.fov,
      minDistance: typeof this.initialState.minDistance === "number" ? this.initialState.minDistance : this.minDistance,
      maxDistance: typeof this.initialState.maxDistance === "number" ? this.initialState.maxDistance : this.maxDistance
    };
  }

  /**
   * Reset the camera rig to initial state.
   */
  reset() {
    this.target.copy(this.initialState.target || new THREE.Vector3(0, 0, 0));
    
    // Shortest angular distance to prevent unnecessary full spins
    const twoPi = Math.PI * 2;
    const targetYawVal = typeof this.initialState.yaw === "number" ? this.initialState.yaw : 0;
    const targetPitchVal = typeof this.initialState.pitch === "number" ? this.initialState.pitch : 0.2;

    const yawDiff = (targetYawVal - this.targetYaw) % twoPi;
    const shortestYawDiff = ((yawDiff + Math.PI * 3) % twoPi) - Math.PI;
    this.targetYaw = this.targetYaw + shortestYawDiff;

    const pitchDiff = (targetPitchVal - this.targetPitch) % twoPi;
    const shortestPitchDiff = ((pitchDiff + Math.PI * 3) % twoPi) - Math.PI;
    this.targetPitch = this.targetPitch + shortestPitchDiff;

    const targetDist = typeof this.initialState.distance === "number" ? this.initialState.distance : 4.0;
    this.targetDistance = THREE.MathUtils.clamp(targetDist, this.minDistance, this.maxDistance);
    this.camera.fov = typeof this.initialState.fov === "number" ? this.initialState.fov : 45;
    this.camera.updateProjectionMatrix();
    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Snap camera view to a standard coordinate axis.
   */
  snapToAxis(axis) {
    if (!axis) return;
    const name = String(axis).toLowerCase();
    let destYaw = this.targetYaw;
    let destPitch = 0;

    switch (name) {
      case "front":
        destYaw = 0;
        destPitch = 0;
        break;
      case "back":
        destYaw = Math.PI;
        destPitch = 0;
        break;
      case "right":
        destYaw = Math.PI / 2;
        destPitch = 0;
        break;
      case "left":
        destYaw = -Math.PI / 2;
        destPitch = 0;
        break;
      case "top":
        destYaw = 0;
        destPitch = -Math.PI / 2;
        break;
      case "bottom":
        destYaw = 0;
        destPitch = Math.PI / 2;
        break;
      default:
        return;
    }

    const twoPi = Math.PI * 2;
    const yawDiff = (destYaw - this.targetYaw) % twoPi;
    const shortestYawDiff = ((yawDiff + Math.PI * 3) % twoPi) - Math.PI;
    this.targetYaw = this.targetYaw + shortestYawDiff;

    const pitchDiff = (destPitch - this.targetPitch) % twoPi;
    const shortestPitchDiff = ((pitchDiff + Math.PI * 3) % twoPi) - Math.PI;
    this.targetPitch = this.targetPitch + shortestPitchDiff;

    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Smoothly fly to a viewpoint or state snapshot.
   */
  flyToViewpoint(viewpoint) {
    if (!viewpoint) return;

    if (Array.isArray(viewpoint.target) && viewpoint.target.length === 3) {
      this.target.set(viewpoint.target[0], viewpoint.target[1], viewpoint.target[2]);
    } else if (viewpoint.target && typeof viewpoint.target.x === "number") {
      this.target.copy(viewpoint.target);
    }

    if (typeof viewpoint.yaw === "number") {
      const twoPi = Math.PI * 2;
      const yawDiff = (viewpoint.yaw - this.targetYaw) % twoPi;
      const shortestYawDiff = ((yawDiff + Math.PI * 3) % twoPi) - Math.PI;
      this.targetYaw = this.targetYaw + shortestYawDiff;
    }

    if (typeof viewpoint.pitch === "number") {
      const twoPi = Math.PI * 2;
      const pitchDiff = (viewpoint.pitch - this.targetPitch) % twoPi;
      const shortestPitchDiff = ((pitchDiff + Math.PI * 3) % twoPi) - Math.PI;
      this.targetPitch = this.targetPitch + shortestPitchDiff;
    }

    if (typeof viewpoint.distance === "number") {
      const minAllowed = this.collisionCheck && this.collisionObject
        ? this.getMinSafeDistance(this.targetYaw, this.targetPitch)
        : this.minDistance;
      this.targetDistance = THREE.MathUtils.clamp(viewpoint.distance, minAllowed, this.maxDistance);
    }

    if (typeof viewpoint.fov === "number" && viewpoint.fov > 5 && viewpoint.fov < 140) {
      this.camera.fov = viewpoint.fov;
      this.camera.updateProjectionMatrix();
    }

    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Smoothly focus and fly toward a specific 3D hotspot location.
   */
  flyToHotspot(hotspotPosition, customDistance = null) {
    if (!hotspotPosition) return;
    const pos = Array.isArray(hotspotPosition)
      ? new THREE.Vector3(...hotspotPosition)
      : (hotspotPosition.isVector3 ? hotspotPosition.clone() : new THREE.Vector3(hotspotPosition.x, hotspotPosition.y, hotspotPosition.z));

    this.target.copy(pos);

    const minAllowed = this.collisionCheck && this.collisionObject
      ? this.getMinSafeDistance(this.targetYaw, this.targetPitch)
      : this.minDistance;

    if (typeof customDistance === "number") {
      this.targetDistance = THREE.MathUtils.clamp(customDistance, minAllowed, this.maxDistance);
    } else if (this.targetDistance > 3.2) {
      this.targetDistance = Math.max(minAllowed, 2.8);
    } else {
      this.targetDistance = Math.max(minAllowed, this.targetDistance);
    }

    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Smoothly fly to target coordinates, distance, and angles
   */
  flyTo(params = {}) {
    this.flyToViewpoint(params);
  }

  /**
   * Get serializable state snapshot.
   */
  getState() {
    return {
      target: [this.target.x, this.target.y, this.target.z],
      yaw: this.targetYaw,
      pitch: this.targetPitch,
      distance: this.targetDistance,
      fov: this.camera.fov,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance
    };
  }

  /**
   * Restore state from a snapshot.
   */
  setState(savedState) {
    if (!savedState) return;

    if (Array.isArray(savedState.target) && savedState.target.length === 3) {
      this.target.set(savedState.target[0], savedState.target[1], savedState.target[2]);
    }
    if (typeof savedState.yaw === "number") {
      this.yaw = savedState.yaw;
      this.targetYaw = savedState.yaw;
    }
    if (typeof savedState.pitch === "number") {
      this.pitch = savedState.pitch;
      this.targetPitch = savedState.pitch;
    }
    if (typeof savedState.minDistance === "number") {
      this.minDistance = savedState.minDistance;
      this.hasExplicitLimits = true;
    }
    if (typeof savedState.maxDistance === "number") {
      this.maxDistance = savedState.maxDistance;
      this.hasExplicitLimits = true;
    }
    if (typeof savedState.distance === "number") {
      const minAllowed = this.collisionCheck && this.collisionObject
        ? this.getMinSafeDistance(this.targetYaw, this.targetPitch)
        : this.minDistance;
      this.distance = THREE.MathUtils.clamp(savedState.distance, minAllowed, this.maxDistance);
      this.targetDistance = this.distance;
    }
    if (typeof savedState.fov === "number") {
      this.camera.fov = savedState.fov;
      this.camera.updateProjectionMatrix();
    }

    this.applyImmediateTransforms();
    if (typeof this.onChange === "function") this.onChange();
  }

  /**
   * Per-frame update step for damping and matrix updates.
   */
  update() {
    if (this.autoRotate && !this.isDragging) {
      this.targetYaw += this.autoRotateSpeed;
    }

    const prevYaw = this.yaw;
    const prevPitch = this.pitch;
    const prevDist = this.distance;
    const prevTargetX = this.currentTarget ? this.currentTarget.x : this.target.x;
    const prevTargetY = this.currentTarget ? this.currentTarget.y : this.target.y;
    const prevTargetZ = this.currentTarget ? this.currentTarget.z : this.target.z;

    // Enforce dynamic anti-clipping collision bounds
    if (this.collisionCheck && this.collisionObject) {
      const safeTargetDist = this.getMinSafeDistance(this.targetYaw, this.targetPitch);
      if (this.targetDistance < safeTargetDist) {
        this.targetDistance = safeTargetDist;
      }
    }

    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance, this.minDistance, this.maxDistance);

    if (this.enableDamping) {
      this.yaw += (this.targetYaw - this.yaw) * this.dampingFactor;
      this.pitch += (this.targetPitch - this.pitch) * this.dampingFactor;
      this.distance += (this.targetDistance - this.distance) * this.dampingFactor;
      this.distance = THREE.MathUtils.clamp(this.distance, this.minDistance, this.maxDistance);
      if (this.currentTarget) {
        this.currentTarget.lerp(this.target, this.dampingFactor);
      }
    } else {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.distance = this.targetDistance;
      if (this.currentTarget) {
        this.currentTarget.copy(this.target);
      }
    }

    // Secondary collision safeguard: ensure current camera distance never penetrates surface during orbital motion
    if (this.collisionCheck && this.collisionObject) {
      const safeCurrentDist = this.getMinSafeDistance(this.yaw, this.pitch);
      if (this.distance < safeCurrentDist) {
        this.distance = safeCurrentDist;
        if (this.targetDistance < safeCurrentDist) {
          this.targetDistance = safeCurrentDist;
        }
      }
    }

    this.applyTransforms();

    const targetMoved = this.currentTarget
      ? (Math.abs(this.currentTarget.x - prevTargetX) > 1e-4 ||
         Math.abs(this.currentTarget.y - prevTargetY) > 1e-4 ||
         Math.abs(this.currentTarget.z - prevTargetZ) > 1e-4)
      : false;

    const moved =
      Math.abs(this.yaw - prevYaw) > 1e-4 ||
      Math.abs(this.pitch - prevPitch) > 1e-4 ||
      Math.abs(this.distance - prevDist) > 1e-4 ||
      targetMoved;

    if (moved && typeof this.onChange === "function") {
      this.onChange();
    }
  }

  // --- Internal transform execution ---

  applyImmediateTransforms() {
    this.yaw = this.targetYaw;
    this.pitch = this.targetPitch;
    this.distance = this.targetDistance;
    if (this.currentTarget) {
      this.currentTarget.copy(this.target);
    }
    this.applyTransforms();
  }

  applyTransforms() {
    // 1. Pivot center moves to target
    const centerPos = this.currentTarget || this.target;
    this.yawPivot.position.copy(centerPos);

    // 2. Yaw pivot rotates horizontally around world Y
    this.yawPivot.rotation.y = this.yaw;

    // 3. Pitch pivot rotates vertically around local X
    this.pitchPivot.rotation.x = this.pitch;

    // 4. Distance pivot offsets along local Z
    this.distancePivot.position.z = this.distance;

    // 5. Update world matrices for camera and pivots
    this.yawPivot.updateMatrixWorld(true);
  }

  // --- Event Handling ---

  attachEvents(domElement) {
    this.domElement = domElement;

    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onWheel = this.handleWheel.bind(this);
    this.onTouchStart = this.handleTouchStart.bind(this);
    this.onTouchMove = this.handleTouchMove.bind(this);
    this.onTouchEnd = this.handleTouchEnd.bind(this);

    domElement.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp, { passive: false });
    window.addEventListener("pointercancel", this.onPointerUp, { passive: false });
    domElement.addEventListener("wheel", this.onWheel, { passive: false });

    domElement.addEventListener("touchstart", this.onTouchStart, { passive: false });
    domElement.addEventListener("touchmove", this.onTouchMove, { passive: false });
    domElement.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  detachEvents() {
    if (!this.domElement) return;

    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.domElement.removeEventListener("wheel", this.onWheel);

    this.domElement.removeEventListener("touchstart", this.onTouchStart);
    this.domElement.removeEventListener("touchmove", this.onTouchMove);
    this.domElement.removeEventListener("touchend", this.onTouchEnd);
  }

  handlePointerDown(event) {
    if (!this.enabled) return;
    if (this.domElement && event.target !== this.domElement) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;

    // Prevent text selection from triggering when navigating 3D viewport
    if (event.pointerType === "mouse" || event.pointerType === "touch" || event.pointerType === "pen") {
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      try {
        document.body.classList.add("navigating-viewport");
      } catch (_) {}
    }

    this.isDragging = true;
    this.activePointerId = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
  }

  handlePointerMove(event) {
    if (!this.enabled || !this.isDragging) return;
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;

    // Clear any accidental selection during fast mouse movements
    if (window.getSelection && window.getSelection().rangeCount > 0) {
      window.getSelection().removeAllRanges();
    }

    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;

    this.pointerStart = { x: event.clientX, y: event.clientY };

    this.rotateYaw(-deltaX * this.rotateSpeed);
    this.rotatePitch(-deltaY * this.rotateSpeed);
  }

  handlePointerUp(event) {
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
    this.isDragging = false;
    this.activePointerId = null;
    try {
      document.body.classList.remove("navigating-viewport");
    } catch (_) {}
  }

  handleWheel(event) {
    if (!this.enabled) return;
    event.preventDefault();
    this.zoom(event.deltaY * this.zoomSpeed);
  }

  handleTouchStart(event) {
    if (!this.enabled) return;
    if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.touchPinchDist = Math.hypot(dx, dy);
    }
  }

  handleTouchMove(event) {
    if (!this.enabled) return;
    if (event.touches.length === 2 && this.touchPinchDist !== null) {
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (this.touchPinchDist - dist) * 0.005;
      this.zoom(delta);
      this.touchPinchDist = dist;
    }
  }

  handleTouchEnd(event) {
    if (event.touches.length < 2) {
      this.touchPinchDist = null;
    }
  }
}
