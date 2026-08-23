import * as THREE from "three";
import { state, notifySelectionChanged } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { removeHotspot, updatePanelHTML } from "../hotspots/hotspots.js";
import {
  applyLightingPreset,
  createAmbientLight,
  createDirectionalLight,
  createPointLight,
  createSpotLight,
  deleteLight,
  deleteSelectedLight,
  updateLights
} from "../lights/lights.js";
import {
  applyBackgroundSettings,
  applyEnvironmentParams,
  frameModel,
  loadEnvironment,
  setAxesVisible,
  setGridVisible,
  setShadowsEnabled
} from "../render/render.js";
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

  const selectionBadge = document.getElementById("inspectorSelectionBadge");

  if (!type || !object) {
    if (selectionBadge) {
      selectionBadge.textContent = "None";
      selectionBadge.style.color = "#71717a";
      selectionBadge.style.background = "#27272a";
    }
    renderEmptyInspector();
    return;
  }

  if (selectionBadge) {
    selectionBadge.textContent = type.toUpperCase();
    selectionBadge.style.color = "#44D62C";
    selectionBadge.style.background = "#1c2e1c";
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
      <p>Select a hotspot, light, camera, or scene from the viewport or the <strong>Scene Hierarchy</strong> tab to inspect and edit properties.</p>
      
      <div class="empty-state-actions">
        <button id="emptyAddHotspotBtn" class="primary-btn">&#10133; Add Hotspot</button>
        <button id="emptyAddLightBtn" class="secondary">&#10133; Add Directional Light</button>
      </div>
    </div>
  `;

  document.getElementById("emptyAddHotspotBtn")?.addEventListener("click", () => {
    document.getElementById("addBtn")?.click();
  });

  document.getElementById("emptyAddLightBtn")?.addEventListener("click", () => {
    createDirectionalLight();
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
  const isAmbient = lightData.type === "ambient";
  const isPoint = lightData.type === "point";
  const isSpot = lightData.type === "spot";
  const isDir = lightData.type === "directional";

  const pos = lightData.light?.position || new THREE.Vector3();
  const targetPos = lightData.target?.position || new THREE.Vector3();

  const typeName = lightData.type ? lightData.type.toUpperCase() + " LIGHT" : "LIGHT";

  return `
    ${buildHeader(typeName, lightData.name || lightData.id, true)}

    <div class="section-group">
      <div class="section-group-title">Light Properties</div>
      
      <div class="param-row-flex">
        <label>Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_light_color" type="color" value="${lightData.color || '#ffffff'}">
          <span style="font-size:0.8rem; font-family:monospace; color:var(--text-dim);">${lightData.color || '#ffffff'}</span>
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header">
          <label>Intensity</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input id="prop_light_intensity_num" type="number" min="0" max="1000" step="0.5" value="${Number(lightData.intensity || 1).toFixed(1)}" style="width:68px; text-align:right; background:var(--bg-input, #1e1e24); border:1px solid var(--border-color, #33333e); color:var(--text-main, #fff); border-radius:4px; padding:2px 6px; font-size:0.8rem; font-family:monospace;">
          </div>
        </div>
        <input id="prop_light_intensity" type="range" min="0" max="100" step="0.5" value="${Math.min(Number(lightData.intensity || 1), 100)}">
      </div>

      ${(isPoint || isSpot) ? `
      <div class="param-row">
        <div class="slider-header">
          <label>Distance (0 = infinite)</label>
          <span class="value-badge" id="light_dist_val">${(lightData.distance || 0).toFixed(1)}m</span>
        </div>
        <input id="prop_light_distance" type="range" min="0" max="100" step="0.5" value="${lightData.distance || 0}">
      </div>

      <div class="param-row">
        <div class="slider-header">
          <label>Decay (Falloff)</label>
          <span class="value-badge" id="light_decay_val">${(lightData.decay !== undefined ? lightData.decay : 2).toFixed(1)}</span>
        </div>
        <input id="prop_light_decay" type="range" min="0" max="4" step="0.1" value="${lightData.decay !== undefined ? lightData.decay : 2}">
      </div>
      ` : ""}

      ${isSpot ? `
      <div class="param-row">
        <div class="slider-header">
          <label>Cone Angle</label>
          <span class="value-badge" id="light_angle_val">${Math.round(THREE.MathUtils.radToDeg(lightData.angle || Math.PI / 4))}°</span>
        </div>
        <input id="prop_light_angle" type="range" min="5" max="85" step="1" value="${Math.round(THREE.MathUtils.radToDeg(lightData.angle || Math.PI / 4))}">
      </div>

      <div class="param-row">
        <div class="slider-header">
          <label>Penumbra (Soft Edge)</label>
          <span class="value-badge" id="light_penumbra_val">${(lightData.penumbra || 0.3).toFixed(2)}</span>
        </div>
        <input id="prop_light_penumbra" type="range" min="0" max="1" step="0.05" value="${lightData.penumbra || 0.3}">
      </div>
      ` : ""}

      ${!isAmbient ? `
      <div class="param-row-checkbox">
        <label>
          <input id="prop_light_shadow" type="checkbox" ${lightData.castShadow ? "checked" : ""}>
          Cast Real-Time Shadows
        </label>
      </div>
      ` : ""}
    </div>

    ${!isAmbient ? buildTransformSection("Light Position", pos) : ""}

    ${(isDir || isSpot) ? `
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
    ` : ""}

    <div class="section-group">
      <div class="section-group-title">Studio Lighting Presets</div>
      <div class="button-grid" style="grid-template-columns: repeat(2, 1fr); gap: 6px;">
        <button class="secondary light-preset-btn" data-preset="clean_studio" title="Clean 3-Point Studio">Clean Studio</button>
        <button class="secondary light-preset-btn" data-preset="dramatic_contrast" title="Dramatic Edge & Rim">Dramatic Rim</button>
        <button class="secondary light-preset-btn" data-preset="dark_showcase" title="Dark Showcase Dual Rim">Dark Showcase</button>
        <button class="secondary light-preset-btn" data-preset="outdoor_sun" title="Outdoor Sunlight & Fill">Outdoor Sun</button>
      </div>
    </div>
  `;
}

function buildLightTargetInspector(lightData) {
  const targetPos = lightData.target.position;
  return `
    ${buildHeader("LIGHT TARGET", `Target of ${lightData.name || lightData.id}`)}
    ${buildTransformSection("Target World Position", targetPos)}
  `;
}

function buildCameraInspector(camera) {
  const target = state.cameraRig?.target || new THREE.Vector3();
  const camWorldPos = new THREE.Vector3();
  camera.getWorldPosition(camWorldPos);

  const viewpoints = state.cameraSettings?.viewpoints || [];

  return `
    ${buildHeader("CAMERA", "Perspective Camera & Default View")}

    <div class="section-group">
      <div class="section-group-title">Default View Actions</div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">
        <button id="btnSetDefaultCamInspector" class="primary-btn" style="width:100%; padding:8px 12px; font-size:12px; font-weight:700;">
          &#9733; Set Current as Default View
        </button>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button id="btnResetDefaultCamInspector" class="secondary" style="font-size:11px; padding:6px;">
            &#8634; Reset to Default
          </button>
          <button id="btnFrameModelFromCam" class="secondary" style="font-size:11px; padding:6px;">
            &#128269; Frame Model
          </button>
        </div>
      </div>

      <div class="param-row-flex" style="margin-top:8px;">
        <label>Auto-Rotate Preview</label>
        <input id="prop_cam_autorotate" type="checkbox" ${state.cameraRig?.autoRotate ? "checked" : ""}>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Snap Camera View to Axis</div>
      <div class="button-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 8px;">
        <button class="secondary inspector-camera-axis-btn" data-axis="front" title="Snap to Front View">Front</button>
        <button class="secondary inspector-camera-axis-btn" data-axis="back" title="Snap to Back View">Back</button>
        <button class="secondary inspector-camera-axis-btn" data-axis="left" title="Snap to Left View">Left</button>
        <button class="secondary inspector-camera-axis-btn" data-axis="right" title="Snap to Right View">Right</button>
        <button class="secondary inspector-camera-axis-btn" data-axis="top" title="Snap to Top View">Top</button>
        <button class="secondary inspector-camera-axis-btn" data-axis="bottom" title="Snap to Bottom View">Bottom</button>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Orbit Target (LookAt Center)</div>
      <div class="param-row">
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_cam_target_x" type="number" step="0.1" value="${target.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_cam_target_y" type="number" step="0.1" value="${target.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_cam_target_z" type="number" step="0.1" value="${target.z.toFixed(2)}"></div>
        </div>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Zoom &amp; Distance Limits</div>
      <div class="param-row">
        <div class="slider-header"><label>Nearest Zoom (Min Distance)</label><span class="value-badge" id="val_cam_min_dist">${(state.cameraRig?.minDistance ?? 1.35).toFixed(2)}m</span></div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_cam_min_dist" type="range" min="0.1" max="20" step="0.1" value="${state.cameraRig?.minDistance ?? 1.35}" style="flex:1;">
          <input id="prop_cam_min_dist_num" type="number" min="0.01" max="500" step="0.1" value="${(state.cameraRig?.minDistance ?? 1.35).toFixed(2)}" style="width:70px; padding:4px 6px; font-size:11px; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Farthest Zoom (Max Distance)</label><span class="value-badge" id="val_cam_max_dist">${(state.cameraRig?.maxDistance ?? 16.0).toFixed(1)}m</span></div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_cam_max_dist" type="range" min="1.0" max="100" step="0.5" value="${state.cameraRig?.maxDistance ?? 16.0}" style="flex:1;">
          <input id="prop_cam_max_dist_num" type="number" min="0.1" max="2000" step="0.5" value="${(state.cameraRig?.maxDistance ?? 16.0).toFixed(1)}" style="width:70px; padding:4px 6px; font-size:11px; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Optics &amp; Clipping</div>
      <div class="param-row">
        <div class="slider-header"><label>Field of View (FOV)</label><span class="value-badge" id="val_fov">${Math.round(camera.fov)}°</span></div>
        <input id="prop_cam_fov" type="range" min="15" max="110" step="1" value="${camera.fov}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Near Clipping Plane</label><span class="value-badge" id="val_near">${camera.near.toFixed(2)}m</span></div>
        <input id="prop_cam_near" type="range" min="0.01" max="1.0" step="0.01" value="${camera.near}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Far Clipping Plane</label><span class="value-badge" id="val_far">${Math.round(camera.far)}m</span></div>
        <input id="prop_cam_far" type="range" min="50" max="2000" step="50" value="${camera.far}">
      </div>
    </div>
  `;
}

function buildSceneInspector() {
  const sceneSettings = state.sceneSettings || {};
  const env = sceneSettings.environment || {};
  const rendering = sceneSettings.rendering || {};
  const helpers = sceneSettings.helpers || {};

  return `
    ${buildHeader("SCENE", "Scene & Environment Settings")}

    <div class="section-group">
      <div class="section-group-title">Background</div>
      
      <div class="param-row">
        <label>Background Type</label>
        <select id="prop_scene_bg_type" class="inspector-select">
          <option value="color" ${sceneSettings.backgroundType === "color" ? "selected" : ""}>Solid Color</option>
          <option value="environment" ${sceneSettings.backgroundType === "environment" ? "selected" : ""}>HDR Skybox</option>
          <option value="transparent" ${sceneSettings.backgroundType === "transparent" ? "selected" : ""}>Transparent</option>
        </select>
      </div>

      <div class="param-row-flex" id="row_scene_bg_color" style="${sceneSettings.backgroundType === 'transparent' ? 'display:none;' : ''}">
        <label>Background Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_scene_bg" type="color" value="${sceneSettings.background || '#222228'}">
          <span style="font-size:0.8rem; font-family:monospace; color:var(--text-dim);">${sceneSettings.background || '#222228'}</span>
        </div>
      </div>

      <div class="param-row" id="row_scene_bg_blur" style="${sceneSettings.backgroundType === 'environment' ? '' : 'display:none;'}">
        <div class="slider-header"><label>Skybox Blur</label><span class="value-badge" id="val_bg_blur">${Number(sceneSettings.backgroundBlur || 0).toFixed(2)}</span></div>
        <input id="prop_scene_bg_blur" type="range" min="0" max="1" step="0.05" value="${sceneSettings.backgroundBlur || 0}">
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">HDR Environment &amp; Reflection</div>

      <div class="param-row">
        <label>Environment Preset</label>
        <select id="prop_scene_env_preset" class="inspector-select">
          <option value="studio_small_09" ${env.preset === "studio_small_09" ? "selected" : ""}>Studio Small 09 (Balanced)</option>
          <option value="potsdamer_platz" ${env.preset === "potsdamer_platz" ? "selected" : ""}>Potsdamer Platz (Urban)</option>
          <option value="autumn_ground" ${env.preset === "autumn_ground" ? "selected" : ""}>Autumn Park (Warm Nature)</option>
          <option value="aircraft_workshop" ${env.preset === "aircraft_workshop" ? "selected" : ""}>Aircraft Workshop (Industrial)</option>
        </select>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Environment Intensity</label><span class="value-badge" id="val_env_intensity">${Number(env.intensity || 1.0).toFixed(1)}</span></div>
        <input id="prop_scene_env_intensity" type="range" min="0" max="4.0" step="0.1" value="${env.intensity || 1.0}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Environment Rotation</label><span class="value-badge" id="val_env_rotation">${Math.round(env.rotation || 0)}°</span></div>
        <input id="prop_scene_env_rotation" type="range" min="0" max="360" step="5" value="${env.rotation || 0}">
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Color Grading &amp; Tone Mapping</div>

      <div class="param-row">
        <label>Tone Mapping</label>
        <select id="prop_scene_tonemapping" class="inspector-select">
          <option value="ACESFilmic" ${env.toneMapping === "ACESFilmic" ? "selected" : ""}>ACES Filmic (Vibrant)</option>
          <option value="AgX" ${env.toneMapping === "AgX" ? "selected" : ""}>AgX (Realistic)</option>
          <option value="Cineon" ${env.toneMapping === "Cineon" ? "selected" : ""}>Cineon</option>
          <option value="Reinhard" ${env.toneMapping === "Reinhard" ? "selected" : ""}>Reinhard</option>
          <option value="Linear" ${env.toneMapping === "Linear" ? "selected" : ""}>Linear</option>
          <option value="None" ${env.toneMapping === "None" ? "selected" : ""}>None</option>
        </select>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Exposure</label><span class="value-badge" id="val_exposure">${Number(env.exposure || 1.6).toFixed(1)}</span></div>
        <input id="prop_scene_exposure" type="range" min="0.1" max="4.0" step="0.1" value="${env.exposure || 1.6}">
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Rendering &amp; Helpers</div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_shadows" type="checkbox" ${rendering.shadows !== false ? "checked" : ""}>
          Enable Real-Time Soft Shadows
        </label>
      </div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_grid" type="checkbox" ${helpers.grid !== false ? "checked" : ""}>
          Show Ground Grid Helper
        </label>
      </div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_axes" type="checkbox" ${helpers.axes ? "checked" : ""}>
          Show 3D Coordinate Axes Helper
        </label>
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
      if (object.light) object.light.position.set(x, y, z);
      if (object.lightSprite) object.lightSprite.position.set(x, y, z);
      updateLights();
    } else if (type === "lightTarget") {
      if (object.target) object.target.position.set(x, y, z);
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
    const lightDist = document.getElementById("prop_light_distance");
    const lightDecay = document.getElementById("prop_light_decay");
    const lightAngle = document.getElementById("prop_light_angle");
    const lightPenumbra = document.getElementById("prop_light_penumbra");
    const lightShadow = document.getElementById("prop_light_shadow");
    const targetX = document.getElementById("prop_target_x");
    const targetY = document.getElementById("prop_target_y");
    const targetZ = document.getElementById("prop_target_z");

    lightColor?.addEventListener("input", (e) => {
      object.color = e.target.value;
      if (object.light) object.light.color.set(object.color);
    });

    const lightIntensityNum = document.getElementById("prop_light_intensity_num");

    const updateIntensity = (val) => {
      const num = Math.max(0, parseFloat(val) || 0);
      object.intensity = num;
      if (object.light) object.light.intensity = num;
      if (lightIntensity && parseFloat(lightIntensity.value) !== num && num <= 100) {
        lightIntensity.value = num;
      }
      if (lightIntensityNum && parseFloat(lightIntensityNum.value) !== num) {
        lightIntensityNum.value = num.toFixed(1);
      }
    };

    lightIntensity?.addEventListener("input", (e) => {
      updateIntensity(e.target.value);
    });

    lightIntensityNum?.addEventListener("input", (e) => {
      updateIntensity(e.target.value);
    });

    lightDist?.addEventListener("input", (e) => {
      object.distance = parseFloat(e.target.value);
      if (object.light) object.light.distance = object.distance;
      const valBadge = document.getElementById("light_dist_val");
      if (valBadge) valBadge.textContent = `${object.distance.toFixed(1)}m`;
    });

    lightDecay?.addEventListener("input", (e) => {
      object.decay = parseFloat(e.target.value);
      if (object.light) object.light.decay = object.decay;
      const valBadge = document.getElementById("light_decay_val");
      if (valBadge) valBadge.textContent = object.decay.toFixed(1);
    });

    lightAngle?.addEventListener("input", (e) => {
      const deg = parseFloat(e.target.value);
      object.angle = THREE.MathUtils.degToRad(deg);
      if (object.light) object.light.angle = object.angle;
      const valBadge = document.getElementById("light_angle_val");
      if (valBadge) valBadge.textContent = `${Math.round(deg)}°`;
      if (object.helper) object.helper.update?.();
    });

    lightPenumbra?.addEventListener("input", (e) => {
      object.penumbra = parseFloat(e.target.value);
      if (object.light) object.light.penumbra = object.penumbra;
      const valBadge = document.getElementById("light_penumbra_val");
      if (valBadge) valBadge.textContent = object.penumbra.toFixed(2);
    });

    lightShadow?.addEventListener("change", (e) => {
      object.castShadow = e.target.checked;
      if (object.light) object.light.castShadow = object.castShadow;
    });

    const onTargetChange = () => {
      const tx = parseFloat(targetX?.value || 0);
      const ty = parseFloat(targetY?.value || 0);
      const tz = parseFloat(targetZ?.value || 0);
      if (object.target) object.target.position.set(tx, ty, tz);
      if (object.targetSprite) object.targetSprite.position.set(tx, ty, tz);
      updateLights();
    };

    [targetX, targetY, targetZ].forEach((el) => el?.addEventListener("input", onTargetChange));

    // Preset buttons handled via delegated click on inspector or sidebar
  } else if (type === "camera") {
    const targetX = document.getElementById("prop_cam_target_x");
    const targetY = document.getElementById("prop_cam_target_y");
    const targetZ = document.getElementById("prop_cam_target_z");
    const camFov = document.getElementById("prop_cam_fov");
    const camNear = document.getElementById("prop_cam_near");
    const camFar = document.getElementById("prop_cam_far");
    const camMinDist = document.getElementById("prop_cam_min_dist");
    const camMinDistNum = document.getElementById("prop_cam_min_dist_num");
    const camMaxDist = document.getElementById("prop_cam_max_dist");
    const camMaxDistNum = document.getElementById("prop_cam_max_dist_num");

    const onCamTargetChange = () => {
      const tx = parseFloat(targetX?.value || 0);
      const ty = parseFloat(targetY?.value || 0);
      const tz = parseFloat(targetZ?.value || 0);
      if (state.cameraRig) {
        state.cameraRig.target.set(tx, ty, tz);
      }
      if (state.controls) {
        state.controls.target.set(tx, ty, tz);
        state.controls.update?.();
      }
    };

    [targetX, targetY, targetZ].forEach((el) => el?.addEventListener("input", onCamTargetChange));

    document.querySelectorAll(".inspector-camera-axis-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const axis = btn.getAttribute("data-axis");
        if (state.cameraRig && axis) {
          state.cameraRig.snapToAxis(axis);
        }
      });
    });

    camFov?.addEventListener("input", (e) => {
      const fovVal = parseFloat(e.target.value);
      object.fov = fovVal;
      object.updateProjectionMatrix();
      if (state.cameraSettings) state.cameraSettings.fov = fovVal;
      const badge = document.getElementById("val_fov");
      if (badge) badge.textContent = `${Math.round(fovVal)}°`;
    });

    camNear?.addEventListener("input", (e) => {
      const nearVal = parseFloat(e.target.value);
      object.near = nearVal;
      object.updateProjectionMatrix();
      if (state.cameraSettings) state.cameraSettings.near = nearVal;
      const badge = document.getElementById("val_near");
      if (badge) badge.textContent = `${nearVal.toFixed(2)}m`;
    });

    camFar?.addEventListener("input", (e) => {
      const farVal = parseFloat(e.target.value);
      object.far = farVal;
      object.updateProjectionMatrix();
      if (state.cameraSettings) state.cameraSettings.far = farVal;
      const badge = document.getElementById("val_far");
      if (badge) badge.textContent = `${Math.round(farVal)}m`;
    });

    const updateCamMinDist = (val) => {
      const num = Math.max(0.01, parseFloat(val) || 0.1);
      if (state.cameraRig) {
        state.cameraRig.minDistance = num;
        state.cameraRig.hasExplicitLimits = true;
        if (state.cameraRig.initialState) state.cameraRig.initialState.minDistance = num;
        if (state.cameraRig.maxDistance < num + 0.05) {
          state.cameraRig.maxDistance = num + 0.5;
          if (state.cameraRig.initialState) state.cameraRig.initialState.maxDistance = state.cameraRig.maxDistance;
          if (camMaxDist) camMaxDist.value = state.cameraRig.maxDistance;
          if (camMaxDistNum) camMaxDistNum.value = state.cameraRig.maxDistance.toFixed(1);
          const maxBadge = document.getElementById("val_cam_max_dist");
          if (maxBadge) maxBadge.textContent = `${state.cameraRig.maxDistance.toFixed(1)}m`;
        }
        state.cameraRig.targetDistance = THREE.MathUtils.clamp(state.cameraRig.targetDistance, state.cameraRig.minDistance, state.cameraRig.maxDistance);
        state.cameraRig.distance = THREE.MathUtils.clamp(state.cameraRig.distance, state.cameraRig.minDistance, state.cameraRig.maxDistance);
      }
      if (state.cameraSettings) state.cameraSettings.minDistance = num;
      if (!state.sceneDocument) state.sceneDocument = {};
      if (!state.sceneDocument.camera) state.sceneDocument.camera = {};
      state.sceneDocument.camera.minDistance = num;
      if (state.cameraRig?.maxDistance) state.sceneDocument.camera.maxDistance = state.cameraRig.maxDistance;

      if (camMinDist && parseFloat(camMinDist.value) !== num && num <= 20) camMinDist.value = num;
      if (camMinDistNum && parseFloat(camMinDistNum.value) !== num) camMinDistNum.value = num.toFixed(2);
      const badge = document.getElementById("val_cam_min_dist");
      if (badge) badge.textContent = `${num.toFixed(2)}m`;
    };

    const updateCamMaxDist = (val) => {
      const minVal = state.cameraRig?.minDistance ?? 0.1;
      const num = Math.max(minVal + 0.05, parseFloat(val) || (minVal + 1));
      if (state.cameraRig) {
        state.cameraRig.maxDistance = num;
        state.cameraRig.hasExplicitLimits = true;
        if (state.cameraRig.initialState) state.cameraRig.initialState.maxDistance = num;
        state.cameraRig.targetDistance = THREE.MathUtils.clamp(state.cameraRig.targetDistance, state.cameraRig.minDistance, state.cameraRig.maxDistance);
        state.cameraRig.distance = THREE.MathUtils.clamp(state.cameraRig.distance, state.cameraRig.minDistance, state.cameraRig.maxDistance);
      }
      if (state.cameraSettings) state.cameraSettings.maxDistance = num;
      if (!state.sceneDocument) state.sceneDocument = {};
      if (!state.sceneDocument.camera) state.sceneDocument.camera = {};
      state.sceneDocument.camera.maxDistance = num;

      if (camMaxDist && parseFloat(camMaxDist.value) !== num && num <= 100) camMaxDist.value = num;
      if (camMaxDistNum && parseFloat(camMaxDistNum.value) !== num) camMaxDistNum.value = num.toFixed(1);
      const badge = document.getElementById("val_cam_max_dist");
      if (badge) badge.textContent = `${num.toFixed(1)}m`;
    };

    camMinDist?.addEventListener("input", (e) => updateCamMinDist(e.target.value));
    camMinDistNum?.addEventListener("input", (e) => updateCamMinDist(e.target.value));
    camMaxDist?.addEventListener("input", (e) => updateCamMaxDist(e.target.value));
    camMaxDistNum?.addEventListener("input", (e) => updateCamMaxDist(e.target.value));

    document.getElementById("btnFrameModelFromCam")?.addEventListener("click", () => {
      if (state.cameraRig && state.currentModel) {
        state.cameraRig.focus(state.currentModel);
        const minBadge = document.getElementById("val_cam_min_dist");
        if (minBadge) minBadge.textContent = `${state.cameraRig.minDistance.toFixed(2)}m`;
        if (camMinDist) camMinDist.value = state.cameraRig.minDistance;
        if (camMinDistNum) camMinDistNum.value = state.cameraRig.minDistance.toFixed(2);
        const maxBadge = document.getElementById("val_cam_max_dist");
        if (maxBadge) maxBadge.textContent = `${state.cameraRig.maxDistance.toFixed(1)}m`;
        if (camMaxDist) camMaxDist.value = state.cameraRig.maxDistance;
        if (camMaxDistNum) camMaxDistNum.value = state.cameraRig.maxDistance.toFixed(1);
      }
    });

    document.getElementById("btnSetDefaultCamInspector")?.addEventListener("click", () => {
      if (state.cameraRig) {
        const camState = state.cameraRig.getState();
        state.cameraRig.setDefaultState(camState);
        if (!state.sceneDocument) state.sceneDocument = {};
        state.sceneDocument.camera = {
          yaw: camState.yaw,
          pitch: camState.pitch,
          distance: camState.distance,
          minDistance: state.cameraRig.minDistance,
          maxDistance: state.cameraRig.maxDistance,
          target: camState.target,
          fov: camState.fov
        };
        const btn = document.getElementById("btnSetDefaultCamInspector");
        if (btn) {
          const original = btn.innerHTML;
          btn.innerHTML = "&#10003; Default Saved!";
          setTimeout(() => { btn.innerHTML = original; }, 1500);
        }
      }
    });

    document.getElementById("btnResetDefaultCamInspector")?.addEventListener("click", () => {
      if (state.cameraRig) {
        state.cameraRig.reset();
        const minBadge = document.getElementById("val_cam_min_dist");
        if (minBadge) minBadge.textContent = `${state.cameraRig.minDistance.toFixed(2)}m`;
        if (camMinDist) camMinDist.value = state.cameraRig.minDistance;
        if (camMinDistNum) camMinDistNum.value = state.cameraRig.minDistance.toFixed(2);
        const maxBadge = document.getElementById("val_cam_max_dist");
        if (maxBadge) maxBadge.textContent = `${state.cameraRig.maxDistance.toFixed(1)}m`;
        if (camMaxDist) camMaxDist.value = state.cameraRig.maxDistance;
        if (camMaxDistNum) camMaxDistNum.value = state.cameraRig.maxDistance.toFixed(1);
      }
    });

    const autoRotateToggle = document.getElementById("prop_cam_autorotate");
    autoRotateToggle?.addEventListener("change", (e) => {
      if (state.cameraRig) {
        state.cameraRig.autoRotate = Boolean(e.target.checked);
      }
    });
  } else if (type === "scene") {
    const bgType = document.getElementById("prop_scene_bg_type");
    const bg = document.getElementById("prop_scene_bg");
    const bgBlur = document.getElementById("prop_scene_bg_blur");
    const envPreset = document.getElementById("prop_scene_env_preset");
    const envIntensity = document.getElementById("prop_scene_env_intensity");
    const envRotation = document.getElementById("prop_scene_env_rotation");
    const tonemapping = document.getElementById("prop_scene_tonemapping");
    const exposure = document.getElementById("prop_scene_exposure");
    const shadows = document.getElementById("prop_scene_shadows");
    const grid = document.getElementById("prop_scene_grid");
    const axes = document.getElementById("prop_scene_axes");

    bgType?.addEventListener("change", (e) => {
      state.sceneSettings.backgroundType = e.target.value;
      applyBackgroundSettings();
      renderInspector();
    });

    bg?.addEventListener("input", (e) => {
      state.sceneSettings.background = e.target.value;
      applyBackgroundSettings();
      const bgInput = document.getElementById("backgroundColor");
      if (bgInput) bgInput.value = e.target.value;
    });

    bgBlur?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.sceneSettings.backgroundBlur = val;
      applyBackgroundSettings();
      const badge = document.getElementById("val_bg_blur");
      if (badge) badge.textContent = val.toFixed(2);
    });

    envPreset?.addEventListener("change", (e) => {
      state.sceneSettings.environment.preset = e.target.value;
      loadEnvironment(e.target.value);
    });

    envIntensity?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.sceneSettings.environment.intensity = val;
      applyEnvironmentParams();
      const badge = document.getElementById("val_env_intensity");
      if (badge) badge.textContent = val.toFixed(1);
    });

    envRotation?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.sceneSettings.environment.rotation = val;
      applyEnvironmentParams();
      const badge = document.getElementById("val_env_rotation");
      if (badge) badge.textContent = `${Math.round(val)}°`;
    });

    tonemapping?.addEventListener("change", (e) => {
      state.sceneSettings.environment.toneMapping = e.target.value;
      applyEnvironmentParams();
    });

    exposure?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.sceneSettings.environment.exposure = val;
      applyEnvironmentParams();
      const badge = document.getElementById("val_exposure");
      if (badge) badge.textContent = val.toFixed(1);
    });

    shadows?.addEventListener("change", (e) => {
      setShadowsEnabled(e.target.checked);
    });

    grid?.addEventListener("change", (e) => {
      setGridVisible(e.target.checked);
    });

    axes?.addEventListener("change", (e) => {
      setAxesVisible(e.target.checked);
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
