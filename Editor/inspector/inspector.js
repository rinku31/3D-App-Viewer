import * as THREE from "three";
import { state, notifySelectionChanged } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { removeHotspot, updatePanelHTML } from "../hotspots/hotspots.js";
import { deleteSelectedLight, updateLights } from "../lights/lights.js";
import { frameModel } from "../render/render.js";
import { updateGizmoAnchorPosition } from "../gizmo/gizmo.js";
import { showSidebarTab } from "../ui/ui.js";

let inspectorContainer = null;

function initializeInspector() {
  inspectorContainer = document.getElementById("propertiesTab");
  if (!inspectorContainer) return;

  window.addEventListener("editorselectionchange", renderInspector);
  renderInspector();
}

function renderInspector() {
  if (!inspectorContainer) {
    inspectorContainer = document.getElementById("propertiesTab");
    if (!inspectorContainer) return;
  }

  const selection = state.selection;
  const { type, object, target } = selection || {};

  if (!type || !object) {
    renderEmptyInspector();
    return;
  }

  // Preserve focus if actively typing
  const activeElement = document.activeElement;
  const activeId = activeElement ? activeElement.id : null;
  const selectionStart = activeElement?.selectionStart;
  const selectionEnd = activeElement?.selectionEnd;

  let html = "";

  if (type === "hotspot") {
    html = buildHotspotInspector(object);
  } else if (type === "light") {
    html = buildLightInspector(object);
  } else if (type === "lightTarget") {
    html = buildLightTargetInspector(object);
  } else if (type === "model") {
    html = buildModelInspector(object);
  } else if (type === "mesh") {
    html = buildMeshInspector(object);
  } else if (type === "camera") {
    html = buildCameraInspector(object);
  } else if (type === "scene") {
    html = buildSceneInspector();
  } else {
    renderEmptyInspector();
    return;
  }

  inspectorContainer.innerHTML = html;
  bindInspectorEvents(type, object, target);

  // Restore focus if appropriate
  if (activeId && document.getElementById(activeId)) {
    const restored = document.getElementById(activeId);
    restored.focus();
    if (selectionStart !== undefined && selectionEnd !== undefined && restored.setSelectionRange) {
      try {
        restored.setSelectionRange(selectionStart, selectionEnd);
      } catch (_) {}
    }
  }
}

function renderEmptyInspector() {
  if (!inspectorContainer) return;
  inspectorContainer.innerHTML = `
    <div class="section inspector-placeholder">
      <div class="empty-state-icon">&#128065;</div>
      <h3>Nothing Selected</h3>
      <p>Select a hotspot, light, model mesh, or camera from the 3D viewport or the <strong>Scene Hierarchy</strong> tab to inspect and edit properties.</p>
      
      <div class="empty-state-actions">
        <button id="emptyAddHotspotBtn" class="primary-btn">&#10133; Add Hotspot</button>
        <button id="emptyAddLightBtn" class="secondary">&#10133; Add Directional Light</button>
        <button id="emptySelectModelBtn" class="secondary">&#128230; Select Model</button>
        <button id="emptyViewHierarchyBtn" class="secondary">&#128450; View Scene Hierarchy</button>
      </div>
    </div>
  `;

  document.getElementById("emptyAddHotspotBtn")?.addEventListener("click", () => {
    document.getElementById("addBtn")?.click();
  });

  document.getElementById("emptyAddLightBtn")?.addEventListener("click", () => {
    document.getElementById("addDirectionalLightBtn")?.click();
  });

  document.getElementById("emptySelectModelBtn")?.addEventListener("click", () => {
    if (state.currentModel) {
      select("model", state.currentModel);
    } else {
      document.getElementById("modelInput")?.click();
    }
  });

  document.getElementById("emptyViewHierarchyBtn")?.addEventListener("click", () => {
    showSidebarTab("scene");
  });
}

function buildHeader(badgeText, titleText, onDelete = null) {
  return `
    <div class="inspector-header">
      <div class="inspector-badge">${badgeText}</div>
      <h3 class="inspector-title">${escapeHTML(titleText)}</h3>
      ${onDelete ? `<button id="inspectorDeleteBtn" class="delete-btn" title="Delete object">&#128465;</button>` : ""}
    </div>
  `;
}

function buildTransformSection(title, pos, rot = null, scale = null) {
  const rotDeg = rot ? {
    x: THREE.MathUtils.radToDeg(rot.x).toFixed(1),
    y: THREE.MathUtils.radToDeg(rot.y).toFixed(1),
    z: THREE.MathUtils.radToDeg(rot.z).toFixed(1),
  } : null;

  return `
    <div class="section-group">
      <div class="section-group-title">${title || "Transform"}</div>
      
      <div class="param-row">
        <label>Position</label>
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_pos_x" type="number" step="0.05" value="${pos.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_pos_y" type="number" step="0.05" value="${pos.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_pos_z" type="number" step="0.05" value="${pos.z.toFixed(2)}"></div>
        </div>
      </div>

      ${rot ? `
      <div class="param-row">
        <label>Rotation (°)</label>
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_rot_x" type="number" step="1" value="${rotDeg.x}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_rot_y" type="number" step="1" value="${rotDeg.y}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_rot_z" type="number" step="1" value="${rotDeg.z}"></div>
        </div>
      </div>` : ""}

      ${scale ? `
      <div class="param-row">
        <label>Scale</label>
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_scale_x" type="number" step="0.05" value="${scale.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_scale_y" type="number" step="0.05" value="${scale.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_scale_z" type="number" step="0.05" value="${scale.z.toFixed(2)}"></div>
        </div>
      </div>` : ""}
    </div>
  `;
}

function buildHotspotInspector(hotspot) {
  const pos = new THREE.Vector3(hotspot.position[0], hotspot.position[1], hotspot.position[2]);

  return `
    ${buildHeader("HOTSPOT", hotspot.title || "Hotspot", true)}

    <div class="section">
      <label>Title</label>
      <input id="prop_hotspot_title" type="text" value="${escapeHTML(hotspot.title)}" placeholder="Hotspot Title">

      <label>Description</label>
      <textarea id="prop_hotspot_desc" rows="3" placeholder="Description text">${escapeHTML(hotspot.description)}</textarea>
    </div>

    ${buildTransformSection("World Position", pos)}

    <div class="section-group">
      <div class="section-group-title">Panel Screen Offset</div>
      <div class="param-row">
        <div class="vector2-inputs">
          <div class="vec-item"><span class="vec-label">X</span><input id="prop_panel_x" type="number" value="${Math.round(hotspot.panelOffset.x)}"></div>
          <div class="vec-item"><span class="vec-label">Y</span><input id="prop_panel_y" type="number" value="${Math.round(hotspot.panelOffset.y)}"></div>
        </div>
      </div>
    </div>
  `;
}

function buildLightInspector(lightData) {
  const pos = lightData.light.position;
  const targetPos = lightData.target.position;

  return `
    ${buildHeader("DIRECTIONAL LIGHT", lightData.id || "Light", true)}

    <div class="section-group">
      <div class="section-group-title">Light Properties</div>
      
      <div class="param-row-flex">
        <label>Color</label>
        <input id="prop_light_color" type="color" value="${lightData.color}">
      </div>

      <div class="param-row">
        <div class="slider-header">
          <label>Intensity</label>
          <span class="value-badge" id="light_intensity_val">${Number(lightData.intensity).toFixed(1)}</span>
        </div>
        <input id="prop_light_intensity" type="range" min="0" max="10" step="0.1" value="${lightData.intensity}">
      </div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_light_shadow" type="checkbox" ${lightData.castShadow ? "checked" : ""}>
          Cast Shadows
        </label>
      </div>
    </div>

    ${buildTransformSection("Light Position", pos)}

    <div class="section-group">
      <div class="section-group-title">Target Position</div>
      <div class="param-row">
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_target_x" type="number" step="0.1" value="${targetPos.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_target_y" type="number" step="0.1" value="${targetPos.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_target_z" type="number" step="0.1" value="${targetPos.z.toFixed(2)}"></div>
        </div>
      </div>
    </div>
  `;
}

function buildLightTargetInspector(lightData) {
  const targetPos = lightData.target.position;
  return `
    ${buildHeader("LIGHT TARGET", `Target of ${lightData.id}`)}
    ${buildTransformSection("Target World Position", targetPos)}
  `;
}

function buildModelInspector(model) {
  let vertexCount = 0;
  let triangleCount = 0;
  let meshCount = 0;

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshCount++;
      const geom = child.geometry;
      if (geom.attributes?.position) {
        vertexCount += geom.attributes.position.count;
      }
      if (geom.index) {
        triangleCount += geom.index.count / 3;
      } else if (geom.attributes?.position) {
        triangleCount += geom.attributes.position.count / 3;
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());

  return `
    ${buildHeader("MODEL", model.name || "GLB Root Model")}

    ${buildTransformSection("Model Transform", model.position, model.rotation, model.scale)}

    <div class="section-group">
      <div class="section-group-title">Model Actions</div>
      <div class="button-grid">
        <button id="btnCenterModel" class="secondary">&#10024; Center Origin</button>
        <button id="btnFrameModel" class="secondary">&#128269; Frame Camera</button>
        <button id="btnResetModelTransform" class="secondary">&#8635; Reset Transform</button>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Model Geometry Stats</div>
      <div class="stats-grid">
        <div class="stat-item"><span class="stat-num">${meshCount}</span><span class="stat-label">Meshes</span></div>
        <div class="stat-item"><span class="stat-num">${vertexCount.toLocaleString()}</span><span class="stat-label">Vertices</span></div>
        <div class="stat-item"><span class="stat-num">${Math.round(triangleCount).toLocaleString()}</span><span class="stat-label">Triangles</span></div>
      </div>
      <div class="stat-dimensions">Size: ${size.x.toFixed(2)}m &times; ${size.y.toFixed(2)}m &times; ${size.z.toFixed(2)}m</div>
    </div>
  `;
}

function buildMeshInspector(mesh) {
  const mat = mesh.material || {};
  const isMultiMat = Array.isArray(mat);
  const primaryMat = isMultiMat ? mat[0] : mat;
  const geom = mesh.geometry;
  const vertCount = geom?.attributes?.position?.count || 0;

  return `
    ${buildHeader("MESH", mesh.name || "Unnamed Mesh")}

    ${buildTransformSection("Mesh Local Transform", mesh.position, mesh.rotation, mesh.scale)}

    <div class="section-group">
      <div class="section-group-title">Material Properties</div>
      
      <div class="param-row-flex">
        <label>Base Color</label>
        <input id="prop_mesh_color" type="color" value="${primaryMat.color ? '#' + primaryMat.color.getHexString() : '#ffffff'}">
      </div>

      ${primaryMat.roughness !== undefined ? `
      <div class="param-row">
        <div class="slider-header"><label>Roughness</label><span class="value-badge" id="val_roughness">${primaryMat.roughness.toFixed(2)}</span></div>
        <input id="prop_mesh_roughness" type="range" min="0" max="1" step="0.02" value="${primaryMat.roughness}">
      </div>` : ""}

      ${primaryMat.metalness !== undefined ? `
      <div class="param-row">
        <div class="slider-header"><label>Metalness</label><span class="value-badge" id="val_metalness">${primaryMat.metalness.toFixed(2)}</span></div>
        <input id="prop_mesh_metalness" type="range" min="0" max="1" step="0.02" value="${primaryMat.metalness}">
      </div>` : ""}

      <div class="param-row-checkbox">
        <label>
          <input id="prop_mesh_wireframe" type="checkbox" ${primaryMat.wireframe ? "checked" : ""}>
          Wireframe
        </label>
      </div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_mesh_visible" type="checkbox" ${mesh.visible ? "checked" : ""}>
          Visible
        </label>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Mesh Info</div>
      <div class="stat-dimensions">Vertices: ${vertCount.toLocaleString()} | Geometry: ${geom?.type || "BufferGeometry"}</div>
    </div>
  `;
}

function buildCameraInspector(camera) {
  const controls = state.controls;
  const target = controls?.target || new THREE.Vector3();

  return `
    ${buildHeader("CAMERA", "Perspective Camera")}

    ${buildTransformSection("Camera Position", camera.position)}

    <div class="section-group">
      <div class="section-group-title">Orbit Target (LookAt)</div>
      <div class="param-row">
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_cam_target_x" type="number" step="0.1" value="${target.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_cam_target_y" type="number" step="0.1" value="${target.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_cam_target_z" type="number" step="0.1" value="${target.z.toFixed(2)}"></div>
        </div>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Optics</div>
      <div class="param-row">
        <div class="slider-header"><label>Field of View (FOV)</label><span class="value-badge" id="val_fov">${Math.round(camera.fov)}°</span></div>
        <input id="prop_cam_fov" type="range" min="15" max="110" step="1" value="${camera.fov}">
      </div>

      <div class="button-grid" style="margin-top:12px;">
        <button id="btnFrameModelFromCam" class="secondary">&#128269; Frame Model</button>
      </div>
    </div>
  `;
}

function buildSceneInspector() {
  return `
    ${buildHeader("SCENE", "Scene Settings")}

    <div class="section-group">
      <div class="section-group-title">Environment &amp; Background</div>
      <div class="param-row-flex">
        <label>Background Color</label>
        <input id="prop_scene_bg" type="color" value="${state.sceneSettings.background || '#3f3f3f'}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Exposure</label><span class="value-badge" id="val_exposure">${(state.renderer?.toneMappingExposure || 1.6).toFixed(1)}</span></div>
        <input id="prop_scene_exposure" type="range" min="0.1" max="4.0" step="0.1" value="${state.renderer?.toneMappingExposure || 1.6}">
      </div>
    </div>
  `;
}

function bindInspectorEvents(type, object, target) {
  // Delete handler
  const deleteBtn = document.getElementById("inspectorDeleteBtn");
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      if (type === "hotspot") {
        removeHotspot(object);
        deselect("hotspot");
      } else if (type === "light") {
        deleteSelectedLight();
        deselect("light");
      }
    };
  }

  // Transform Position handlers (Universal)
  const posX = document.getElementById("prop_pos_x");
  const posY = document.getElementById("prop_pos_y");
  const posZ = document.getElementById("prop_pos_z");

  const onPosChange = () => {
    const x = parseFloat(posX?.value || 0);
    const y = parseFloat(posY?.value || 0);
    const z = parseFloat(posZ?.value || 0);

    if (type === "hotspot") {
      object.position = [x, y, z];
      updateGizmoAnchorPosition(x, y, z);
    } else if (type === "light") {
      object.light.position.set(x, y, z);
      if (object.lightSprite) object.lightSprite.position.set(x, y, z);
      updateLights();
    } else if (type === "lightTarget") {
      object.target.position.set(x, y, z);
      if (object.targetSprite) object.targetSprite.position.set(x, y, z);
      updateLights();
    } else if (type === "model" || type === "mesh" || type === "camera") {
      object.position.set(x, y, z);
    }
  };

  [posX, posY, posZ].forEach((el) => el?.addEventListener("input", onPosChange));

  // Transform Rotation handlers
  const rotX = document.getElementById("prop_rot_x");
  const rotY = document.getElementById("prop_rot_y");
  const rotZ = document.getElementById("prop_rot_z");

  const onRotChange = () => {
    if (type === "model" || type === "mesh") {
      const rx = THREE.MathUtils.degToRad(parseFloat(rotX?.value || 0));
      const ry = THREE.MathUtils.degToRad(parseFloat(rotY?.value || 0));
      const rz = THREE.MathUtils.degToRad(parseFloat(rotZ?.value || 0));
      object.rotation.set(rx, ry, rz);
    }
  };

  [rotX, rotY, rotZ].forEach((el) => el?.addEventListener("input", onRotChange));

  // Transform Scale handlers
  const scaleX = document.getElementById("prop_scale_x");
  const scaleY = document.getElementById("prop_scale_y");
  const scaleZ = document.getElementById("prop_scale_z");

  const onScaleChange = () => {
    if (type === "model" || type === "mesh") {
      const sx = parseFloat(scaleX?.value || 1);
      const sy = parseFloat(scaleY?.value || 1);
      const sz = parseFloat(scaleZ?.value || 1);
      object.scale.set(sx, sy, sz);
    }
  };

  [scaleX, scaleY, scaleZ].forEach((el) => el?.addEventListener("input", onScaleChange));

  // Type specific bindings
  if (type === "hotspot") {
    const titleInput = document.getElementById("prop_hotspot_title");
    const descInput = document.getElementById("prop_hotspot_desc");
    const panelX = document.getElementById("prop_panel_x");
    const panelY = document.getElementById("prop_panel_y");

    titleInput?.addEventListener("input", (e) => {
      object.title = e.target.value;
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    descInput?.addEventListener("input", (e) => {
      object.description = e.target.value;
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    panelX?.addEventListener("input", (e) => {
      object.panelOffset.x = Number(e.target.value);
    });

    panelY?.addEventListener("input", (e) => {
      object.panelOffset.y = Number(e.target.value);
    });
  } else if (type === "light") {
    const lightColor = document.getElementById("prop_light_color");
    const lightIntensity = document.getElementById("prop_light_intensity");
    const lightShadow = document.getElementById("prop_light_shadow");
    const targetX = document.getElementById("prop_target_x");
    const targetY = document.getElementById("prop_target_y");
    const targetZ = document.getElementById("prop_target_z");

    lightColor?.addEventListener("input", (e) => {
      object.color = e.target.value;
      object.light.color.set(object.color);
    });

    lightIntensity?.addEventListener("input", (e) => {
      object.intensity = parseFloat(e.target.value);
      object.light.intensity = object.intensity;
      const valBadge = document.getElementById("light_intensity_val");
      if (valBadge) valBadge.textContent = object.intensity.toFixed(1);
    });

    lightShadow?.addEventListener("change", (e) => {
      object.castShadow = e.target.checked;
      object.light.castShadow = object.castShadow;
    });

    const onTargetChange = () => {
      const tx = parseFloat(targetX?.value || 0);
      const ty = parseFloat(targetY?.value || 0);
      const tz = parseFloat(targetZ?.value || 0);
      object.target.position.set(tx, ty, tz);
      if (object.targetSprite) object.targetSprite.position.set(tx, ty, tz);
      updateLights();
    };

    [targetX, targetY, targetZ].forEach((el) => el?.addEventListener("input", onTargetChange));
  } else if (type === "model") {
    document.getElementById("btnCenterModel")?.addEventListener("click", () => {
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      object.position.sub(center);
      notifySelectionChanged();
    });

    document.getElementById("btnFrameModel")?.addEventListener("click", () => {
      frameModel(object);
    });

    document.getElementById("btnResetModelTransform")?.addEventListener("click", () => {
      object.position.set(0, 0, 0);
      object.rotation.set(0, 0, 0);
      object.scale.set(1, 1, 1);
      notifySelectionChanged();
    });
  } else if (type === "mesh") {
    const meshColor = document.getElementById("prop_mesh_color");
    const meshRoughness = document.getElementById("prop_mesh_roughness");
    const meshMetalness = document.getElementById("prop_mesh_metalness");
    const meshWireframe = document.getElementById("prop_mesh_wireframe");
    const meshVisible = document.getElementById("prop_mesh_visible");

    meshColor?.addEventListener("input", (e) => {
      if (object.material?.color) {
        object.material.color.set(e.target.value);
      }
    });

    meshRoughness?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (object.material && object.material.roughness !== undefined) {
        object.material.roughness = val;
      }
      const badge = document.getElementById("val_roughness");
      if (badge) badge.textContent = val.toFixed(2);
    });

    meshMetalness?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (object.material && object.material.metalness !== undefined) {
        object.material.metalness = val;
      }
      const badge = document.getElementById("val_metalness");
      if (badge) badge.textContent = val.toFixed(2);
    });

    meshWireframe?.addEventListener("change", (e) => {
      if (object.material) {
        object.material.wireframe = e.target.checked;
      }
    });

    meshVisible?.addEventListener("change", (e) => {
      object.visible = e.target.checked;
    });
  } else if (type === "camera") {
    const targetX = document.getElementById("prop_cam_target_x");
    const targetY = document.getElementById("prop_cam_target_y");
    const targetZ = document.getElementById("prop_cam_target_z");
    const camFov = document.getElementById("prop_cam_fov");

    const onCamTargetChange = () => {
      if (state.controls) {
        state.controls.target.set(
          parseFloat(targetX?.value || 0),
          parseFloat(targetY?.value || 0),
          parseFloat(targetZ?.value || 0)
        );
        state.controls.update();
      }
    };

    [targetX, targetY, targetZ].forEach((el) => el?.addEventListener("input", onCamTargetChange));

    camFov?.addEventListener("input", (e) => {
      const fovVal = parseFloat(e.target.value);
      object.fov = fovVal;
      object.updateProjectionMatrix();
      const badge = document.getElementById("val_fov");
      if (badge) badge.textContent = `${Math.round(fovVal)}°`;
    });

    document.getElementById("btnFrameModelFromCam")?.addEventListener("click", () => {
      if (state.currentModel) frameModel(state.currentModel);
    });
  } else if (type === "scene") {
    const sceneBg = document.getElementById("prop_scene_bg");
    const sceneExp = document.getElementById("prop_scene_exposure");

    sceneBg?.addEventListener("input", (e) => {
      state.sceneSettings.background = e.target.value;
      if (state.scene) state.scene.background = new THREE.Color(e.target.value);
      const bgInput = document.getElementById("backgroundColor");
      if (bgInput) bgInput.value = e.target.value;
    });

    sceneExp?.addEventListener("input", (e) => {
      const expVal = parseFloat(e.target.value);
      if (state.renderer) state.renderer.toneMappingExposure = expVal;
      const badge = document.getElementById("val_exposure");
      if (badge) badge.textContent = expVal.toFixed(1);
    });
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export {
  initializeInspector,
  renderInspector
};
