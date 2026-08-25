import * as THREE from "three";
import { state, notifySelectionChanged } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { removeHotspot, updatePanelHTML } from "../hotspots/hotspots.js";
import {
  applyLightingPreset,
  createAmbientLight,
  createAreaLight,
  createDirectionalLight,
  createPointLight,
  createSpotLight,
  deleteLight,
  deleteSelectedLight,
  kelvinToHex,
  KELVIN_PRESETS,
  CYCLES_LIGHTING_PRESETS,
  updateLights
} from "../lights/lights.js";
import {
  applyBackgroundSettings,
  applyBloomSettings,
  applyEnvironmentParams,
  frameModel,
  getBloomSettings,
  loadEnvironment,
  setAxesVisible,
  setBloomEnabled,
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
  } else if (type === "model") {
    html = buildModelInspector(object);
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

function buildModelInspector(model) {
  const rot = model.rotation;
  const rotDeg = {
    x: THREE.MathUtils.radToDeg(rot.x).toFixed(1),
    y: THREE.MathUtils.radToDeg(rot.y).toFixed(1),
    z: THREE.MathUtils.radToDeg(rot.z).toFixed(1),
  };
  const pos = model.position;
  const scale = model.scale;

  return `
    ${buildHeader("MODEL", model.name || "3D Model")}

    <div class="section-group">
      <div class="section-group-title">Model Rotation (° degrees)</div>
      
      <div class="param-row">
        <label>Rotation Inputs</label>
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_model_rot_x" type="number" step="1" value="${rotDeg.x}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_model_rot_y" type="number" step="1" value="${rotDeg.y}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_model_rot_z" type="number" step="1" value="${rotDeg.z}"></div>
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Rotate X</label><span class="value-badge" id="val_model_rot_x">${rotDeg.x}°</span></div>
        <input id="prop_model_rot_slider_x" type="range" min="-180" max="180" step="1" value="${Math.round(parseFloat(rotDeg.x))}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Rotate Y</label><span class="value-badge" id="val_model_rot_y">${rotDeg.y}°</span></div>
        <input id="prop_model_rot_slider_y" type="range" min="-180" max="180" step="1" value="${Math.round(parseFloat(rotDeg.y))}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Rotate Z</label><span class="value-badge" id="val_model_rot_z">${rotDeg.z}°</span></div>
        <input id="prop_model_rot_slider_z" type="range" min="-180" max="180" step="1" value="${Math.round(parseFloat(rotDeg.z))}">
      </div>

      <div style="display:flex; gap:8px; margin-top:10px;">
        <button id="btn_reset_model_rot" class="secondary" style="flex:1; font-size:11px; padding:6px 8px;">Reset Rotation</button>
        <button id="btn_frame_model_inspector" class="secondary" style="flex:1; font-size:11px; padding:6px 8px;">Frame in View</button>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Model Position & Scale</div>
      <div class="param-row">
        <label>Position</label>
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_pos_x" type="number" step="0.05" value="${pos.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_pos_y" type="number" step="0.05" value="${pos.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_pos_z" type="number" step="0.05" value="${pos.z.toFixed(2)}"></div>
        </div>
      </div>
      <div class="param-row">
        <label>Scale</label>
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_scale_x" type="number" step="0.05" value="${scale.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_scale_y" type="number" step="0.05" value="${scale.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_scale_z" type="number" step="0.05" value="${scale.z.toFixed(2)}"></div>
        </div>
      </div>
    </div>
  `;
}

function buildHotspotInspector(hotspot) {
  const pos = new THREE.Vector3(hotspot.position[0], hotspot.position[1], hotspot.position[2]);
  const listItems = Array.isArray(hotspot.listItems) ? hotspot.listItems : [];
  const btn = hotspot.button || { enabled: false, text: "Show Article", url: "", jsFunction: "" };

  return `
    ${buildHeader("HOTSPOT", hotspot.title || "Hotspot", true)}

    <div class="section">
      <label>Title</label>
      <input id="prop_hotspot_title" type="text" value="${escapeHTML(hotspot.title)}" placeholder="Hotspot Title">

      <label>Description</label>
      <textarea id="prop_hotspot_desc" rows="3" placeholder="Description text">${escapeHTML(hotspot.description)}</textarea>
    </div>

    <div class="section-group">
      <div class="section-group-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Hotspot List Items</span>
        <button id="btnAddHotspotListItem" class="secondary" style="font-size:10px; padding:2px 6px;">+ Add Item</button>
      </div>

      <div id="hotspot_list_items_container" style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
        ${listItems.length === 0 ? `
          <div style="font-size:11px; color:var(--text-dim, #888); font-style:italic; padding:4px 0;">No list items. Click "+ Add Item" to add bullet points below description.</div>
        ` : listItems.map((item, idx) => `
          <div class="hotspot-list-item-row" style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:12px; color:var(--accent, #44D62C);">&bull;</span>
            <input type="text" class="hotspot-list-item-input" data-item-idx="${idx}" value="${escapeHTML(item)}" placeholder="List bullet item..." style="flex:1; font-size:12px; padding:4px 6px;">
            <button class="delete-btn btn-delete-list-item" data-item-idx="${idx}" title="Remove item" style="padding:2px 6px; font-size:11px;">&#128465;</button>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Hotspot Action Button</div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_hotspot_btn_enable" type="checkbox" ${btn.enabled ? "checked" : ""}>
          Enable Button below list items
        </label>
      </div>

      <div id="hotspot_btn_options_box" style="${btn.enabled ? '' : 'display:none;'} margin-top:8px;">
        <div class="param-row">
          <label>Button Text</label>
          <input id="prop_hotspot_btn_text" type="text" value="${escapeHTML(btn.text || "Show Article")}" placeholder="Show Article">
        </div>

        <div class="param-row">
          <label>Link URL (optional)</label>
          <input id="prop_hotspot_btn_url" type="url" value="${escapeHTML(btn.url || "")}" placeholder="https://example.com/article">
        </div>

        <div class="param-row">
          <label>Parent JS Function Name (optional)</label>
          <input id="prop_hotspot_btn_fn" type="text" value="${escapeHTML(btn.jsFunction || "")}" placeholder="e.g. onHotspotAction">
          <div style="font-size:10px; color:var(--text-dim, #888); margin-top:3px;">
            Calls function on parent page outside embed iframe or dispatches message.
          </div>
        </div>
      </div>
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

    <div class="section-group">
      <div class="section-group-title">Hotspots &amp; Connector Line (Global)</div>

      <div class="param-row-flex">
        <label>Panel Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_panel_color" type="color" value="${(state.sceneSettings?.hotspots?.panelColor || '#1e1e24').startsWith('#') ? (state.sceneSettings?.hotspots?.panelColor || '#1e1e24') : '#1e1e24'}">
          <input id="prop_hotspot_panel_color_text" type="text" value="${state.sceneSettings?.hotspots?.panelColor || 'rgba(30, 30, 35, 0.92)'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row-flex">
        <label>Title Font Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_title_font_color" type="color" value="${(state.sceneSettings?.hotspots?.titleFontColor || '#ffffff').startsWith('#') ? (state.sceneSettings?.hotspots?.titleFontColor || '#ffffff') : '#ffffff'}">
          <input id="prop_hotspot_title_font_color_text" type="text" value="${state.sceneSettings?.hotspots?.titleFontColor || '#ffffff'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
      <div class="param-row">
        <div class="slider-header"><label>Title Font Size (px)</label><span class="value-badge" id="val_hotspot_title_font_size">${state.sceneSettings?.hotspots?.titleFontSize || 14}</span></div>
        <input id="prop_hotspot_title_font_size" type="range" min="10" max="24" step="1" value="${state.sceneSettings?.hotspots?.titleFontSize || 14}">
      </div>

      <div class="param-row-flex">
        <label>Description Font Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_desc_font_color" type="color" value="${(state.sceneSettings?.hotspots?.descFontColor || '#e0e0e0').startsWith('#') ? (state.sceneSettings?.hotspots?.descFontColor || '#e0e0e0') : '#e0e0e0'}">
          <input id="prop_hotspot_desc_font_color_text" type="text" value="${state.sceneSettings?.hotspots?.descFontColor || '#e0e0e0'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
      <div class="param-row">
        <div class="slider-header"><label>Description Font Size (px)</label><span class="value-badge" id="val_hotspot_desc_font_size">${state.sceneSettings?.hotspots?.descFontSize || 12.5}</span></div>
        <input id="prop_hotspot_desc_font_size" type="range" min="9" max="20" step="0.5" value="${state.sceneSettings?.hotspots?.descFontSize || 12.5}">
      </div>

      <div class="param-row-flex">
        <label>List Font Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_list_font_color" type="color" value="${(state.sceneSettings?.hotspots?.listFontColor || '#cccccc').startsWith('#') ? (state.sceneSettings?.hotspots?.listFontColor || '#cccccc') : '#cccccc'}">
          <input id="prop_hotspot_list_font_color_text" type="text" value="${state.sceneSettings?.hotspots?.listFontColor || '#cccccc'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
      <div class="param-row">
        <div class="slider-header"><label>List Font Size (px)</label><span class="value-badge" id="val_hotspot_list_font_size">${state.sceneSettings?.hotspots?.listFontSize || 11}</span></div>
        <input id="prop_hotspot_list_font_size" type="range" min="8" max="18" step="0.5" value="${state.sceneSettings?.hotspots?.listFontSize || 11}">
      </div>

      <div class="param-row">
        <label>Connector Line Style</label>
        <select id="prop_line_style" class="inspector-select">
          <option value="dashed" ${(state.sceneSettings?.line?.style || 'dashed') === 'dashed' ? 'selected' : ''}>Broken / Dashed Line</option>
          <option value="solid" ${state.sceneSettings?.line?.style === 'solid' ? 'selected' : ''}>Solid Line</option>
        </select>
      </div>

      <div class="param-row-flex">
        <label>Connector Line Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_line_color" type="color" value="${(state.sceneSettings?.line?.color || '#44D62C').startsWith('#') ? (state.sceneSettings?.line?.color || '#44D62C') : '#44D62C'}">
          <input id="prop_line_color_text" type="text" value="${state.sceneSettings?.line?.color || '#44D62C'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Connector Line Width</label><span class="value-badge" id="val_line_width">${Number(state.sceneSettings?.line?.width || 1.5).toFixed(1)}px</span></div>
        <input id="prop_line_width" type="range" min="1" max="6" step="0.5" value="${state.sceneSettings?.line?.width || 1.5}">
      </div>
    </div>
  `;
}

function buildLightInspector(lightData) {
  const rawType = (lightData.type || "directional").toLowerCase();
  const isAmbient = rawType.includes("ambient");
  const isPoint = rawType.includes("point");
  const isSpot = rawType.includes("spot");
  const isArea = rawType.includes("area") || rawType.includes("rect");
  const isDir = !isAmbient && !isPoint && !isSpot && !isArea;

  const pos = lightData.light?.position || new THREE.Vector3();
  const targetPos = lightData.target?.position || new THREE.Vector3();

  const typeName = isArea 
    ? "AREA SOFTBOX" 
    : isPoint
    ? "POINT LIGHT"
    : isSpot
    ? "SPOT LIGHT"
    : isAmbient
    ? "AMBIENT LIGHT"
    : "DIRECTIONAL LIGHT";

  return `
    ${buildHeader(typeName, lightData.name || lightData.id, true)}

    <div class="section-group">
      <div class="section-group-title">Blender Cycles Light Properties</div>
      
      <div class="param-row-flex">
        <label>Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_light_color" type="color" value="${lightData.color || '#ffffff'}">
          <span style="font-size:0.8rem; font-family:monospace; color:var(--text-dim);">${lightData.color || '#ffffff'}</span>
        </div>
      </div>

      <div class="param-row">
        <label style="font-size:11px; margin-bottom:4px; display:block; color:var(--text-dim, #999);">Color Temperature (Kelvin)</label>
        <div class="kelvin-pills-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:4px;">
          ${KELVIN_PRESETS.map(p => `
            <button class="kelvin-pill-btn secondary" data-kelvin="${p.kelvin}" data-hex="${p.color}" title="${p.name}" style="font-size:10px; padding:3px 4px; text-align:center; display:flex; align-items:center; justify-content:center; gap:4px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${p.color}; border:1px solid rgba(255,255,255,0.2);"></span>
              ${p.kelvin}K
            </button>
          `).join("")}
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header">
          <label>Power / Intensity</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input id="prop_light_intensity_num" type="number" min="0" max="1000" step="0.5" value="${Number(lightData.intensity || 1).toFixed(1)}" style="width:68px; text-align:right; background:var(--bg-input, #1e1e24); border:1px solid var(--border-color, #33333e); color:var(--text-main, #fff); border-radius:4px; padding:2px 6px; font-size:0.8rem; font-family:monospace;">
          </div>
        </div>
        <input id="prop_light_intensity" type="range" min="0" max="100" step="0.5" value="${Math.min(Number(lightData.intensity || 1), 100)}">
      </div>

      ${isArea ? `
      <div class="param-row">
        <label>Softbox Dimensions (WxH)</label>
        <div class="vector2-inputs" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div class="vec-item" style="display:flex; align-items:center; gap:4px;"><span class="vec-label">W</span><input id="prop_area_width" type="number" min="0.1" max="50" step="0.1" value="${(lightData.width !== undefined ? Number(lightData.width) : (lightData.light?.width !== undefined ? Number(lightData.light.width) : 2.5)).toFixed(1)}" style="width:100%; padding:4px 6px; font-size:11px; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;"></div>
          <div class="vec-item" style="display:flex; align-items:center; gap:4px;"><span class="vec-label">H</span><input id="prop_area_height" type="number" min="0.1" max="50" step="0.1" value="${(lightData.height !== undefined ? Number(lightData.height) : (lightData.light?.height !== undefined ? Number(lightData.light.height) : 2.5)).toFixed(1)}" style="width:100%; padding:4px 6px; font-size:11px; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;"></div>
        </div>
      </div>
      ` : ""}

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
          <label>Decay (Inverse-Square Falloff)</label>
          <span class="value-badge" id="light_decay_val">${(lightData.decay !== undefined ? lightData.decay : 2).toFixed(1)}</span>
        </div>
        <input id="prop_light_decay" type="range" min="0" max="4" step="0.1" value="${lightData.decay !== undefined ? lightData.decay : 2}">
      </div>
      ` : ""}

      ${isSpot ? `
      <div class="param-row">
        <div class="slider-header">
          <label>Spot Size (Angle)</label>
          <span class="value-badge" id="light_angle_val">${Math.round(THREE.MathUtils.radToDeg(lightData.angle || Math.PI / 4))}°</span>
        </div>
        <input id="prop_light_angle" type="range" min="5" max="85" step="1" value="${Math.round(THREE.MathUtils.radToDeg(lightData.angle || Math.PI / 4))}">
      </div>

      <div class="param-row">
        <div class="slider-header">
          <label>Blend (Penumbra Softness)</label>
          <span class="value-badge" id="light_penumbra_val">${(lightData.penumbra || 0.3).toFixed(2)}</span>
        </div>
        <input id="prop_light_penumbra" type="range" min="0" max="1" step="0.05" value="${lightData.penumbra || 0.3}">
      </div>
      ` : ""}

      ${(!isAmbient && !isArea) ? `
      <div class="param-row">
        <div class="slider-header">
          <label>Light Radius (Shadow Softness)</label>
          <span class="value-badge" id="light_radius_val">${(lightData.radius || 2.0).toFixed(1)}</span>
        </div>
        <input id="prop_light_radius" type="range" min="0.5" max="10" step="0.5" value="${lightData.radius || 2.0}">
      </div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_light_shadow" type="checkbox" ${lightData.castShadow ? "checked" : ""}>
          Cast Real-Time Contact Shadows
        </label>
      </div>
      ` : ""}
    </div>

    ${!isAmbient ? buildTransformSection("Light Position", pos) : ""}

    ${(isDir || isSpot || isArea) ? `
    <div class="section-group">
      <div class="section-group-title">Target / Aim Position</div>
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
      <div class="section-group-title">Blender Cycles Lighting Presets</div>
      <div class="button-grid" style="grid-template-columns: repeat(2, 1fr); gap: 6px;">
        <button class="secondary light-preset-btn" data-preset="cycles_studio" title="Blender Cycles 3-Point Studio">Cycles Studio</button>
        <button class="secondary light-preset-btn" data-preset="cycles_product" title="Cycles Product Showcase Top Softbox">Product Showcase</button>
        <button class="secondary light-preset-btn" data-preset="cycles_sun" title="Cycles Outdoor Sun & Contact Shadows">Outdoor Sun</button>
        <button class="secondary light-preset-btn" data-preset="cycles_moody" title="Cycles Cinematic Moody Edge">Moody Cinematic</button>
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
  const currentMinPitchDeg = state.cameraRig ? state.cameraRig.getMinPitchDeg() : (state.cameraSettings?.minPitch ?? -82);
  const currentMaxPitchDeg = state.cameraRig ? state.cameraRig.getMaxPitchDeg() : (state.cameraSettings?.maxPitch ?? 82);

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
      <div class="section-group-title">Vertical Pitch Limits (Rotation Clamping)</div>
      <div class="param-row">
        <div class="slider-header"><label>Min Pitch (Look Down / Bottom Limit)</label><span class="value-badge" id="val_cam_min_pitch">${currentMinPitchDeg}°</span></div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_cam_min_pitch" type="range" min="-89" max="0" step="1" value="${currentMinPitchDeg}" style="flex:1;">
          <input id="prop_cam_min_pitch_num" type="number" min="-89" max="89" step="1" value="${currentMinPitchDeg}" style="width:70px; padding:4px 6px; font-size:11px; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Max Pitch (Look Up / Top Limit)</label><span class="value-badge" id="val_cam_max_pitch">${currentMaxPitchDeg > 0 ? `+${currentMaxPitchDeg}` : currentMaxPitchDeg}°</span></div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_cam_max_pitch" type="range" min="0" max="89" step="1" value="${currentMaxPitchDeg}" style="flex:1;">
          <input id="prop_cam_max_pitch_num" type="number" min="-89" max="89" step="1" value="${currentMaxPitchDeg}" style="width:70px; padding:4px 6px; font-size:11px; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row" style="margin-top:6px;">
        <div class="button-group" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
          <button class="secondary inspector-pitch-preset-btn" data-min="-82" data-max="82" title="Standard Clamping (-82° to +82°)">-82° / +82°</button>
          <button class="secondary inspector-pitch-preset-btn" data-min="0" data-max="82" title="Horizon to Sky (0° to +82°)">0° / +82°</button>
          <button class="secondary inspector-pitch-preset-btn" data-min="-89" data-max="89" title="Full Orbit (-89° to +89°)">-89° / +89°</button>
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

  const currentExposure = env.exposure !== undefined ? Number(env.exposure) : 1.0;
  const currentEV = env.exposureEV !== undefined ? Number(env.exposureEV) : Math.log2(Math.max(0.01, currentExposure));

  return `
    ${buildHeader("SCENE", "Scene & Blender Color Management")}

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
      <div class="section-group-title">Blender World &amp; HDR Environment</div>

      <div class="param-row">
        <label>Environment Preset</label>
        <select id="prop_scene_env_preset" class="inspector-select">
          <option value="studio_small_09" ${env.preset === "studio_small_09" ? "selected" : ""}>Studio Small 09 (Balanced Neutral)</option>
          <option value="potsdamer_platz" ${env.preset === "potsdamer_platz" ? "selected" : ""}>Potsdamer Platz (Urban Daylight)</option>
          <option value="autumn_ground" ${env.preset === "autumn_ground" ? "selected" : ""}>Autumn Park (Warm Sunlight)</option>
          <option value="aircraft_workshop" ${env.preset === "aircraft_workshop" ? "selected" : ""}>Aircraft Workshop (High Dynamic Range)</option>
        </select>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>World Strength</label><span class="value-badge" id="val_env_intensity">${Number(env.intensity !== undefined ? env.intensity : 1.0).toFixed(2)}</span></div>
        <input id="prop_scene_env_intensity" type="range" min="0" max="4.0" step="0.05" value="${env.intensity !== undefined ? env.intensity : 1.0}">
      </div>

      <div class="param-row">
        <div class="slider-header"><label>World Rotation</label><span class="value-badge" id="val_env_rotation">${Math.round(env.rotation || 0)}°</span></div>
        <input id="prop_scene_env_rotation" type="range" min="0" max="360" step="5" value="${env.rotation || 0}">
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Blender Color Management (AgX)</div>

      <div class="param-row">
        <label>View Transform</label>
        <select id="prop_scene_tonemapping" class="inspector-select">
          <option value="AgX" ${env.toneMapping === "AgX" ? "selected" : ""}>AgX (Blender 4.0+ Default)</option>
          <option value="ACESFilmic" ${env.toneMapping === "ACESFilmic" ? "selected" : ""}>ACES Filmic</option>
          <option value="Cineon" ${env.toneMapping === "Cineon" ? "selected" : ""}>Filmic / Cineon</option>
          <option value="Reinhard" ${env.toneMapping === "Reinhard" ? "selected" : ""}>Reinhard</option>
          <option value="Linear" ${env.toneMapping === "Linear" ? "selected" : ""}>Standard / Raw Linear</option>
          <option value="None" ${env.toneMapping === "None" ? "selected" : ""}>None (Unclamped)</option>
        </select>
      </div>

      <div class="param-row">
        <label>Look / Contrast</label>
        <select id="prop_scene_look" class="inspector-select">
          <option value="None" ${env.look === "None" ? "selected" : ""}>None (Natural)</option>
          <option value="Medium Contrast" ${env.look === "Medium Contrast" ? "selected" : ""}>Medium Contrast</option>
          <option value="High Contrast" ${env.look === "High Contrast" ? "selected" : ""}>High Contrast</option>
          <option value="Very High Contrast" ${env.look === "Very High Contrast" ? "selected" : ""}>Very High Contrast</option>
        </select>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Exposure (EV)</label><span class="value-badge" id="val_exposure_ev">${currentEV >= 0 ? "+" : ""}${currentEV.toFixed(2)} EV</span></div>
        <input id="prop_scene_exposure_ev" type="range" min="-3.0" max="3.0" step="0.1" value="${currentEV.toFixed(2)}">
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Bloom &amp; Post-Processing</div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_bloom_enable" type="checkbox" ${sceneSettings.bloom?.enabled ? "checked" : ""}>
          Enable Bloom / Glow Effect
        </label>
      </div>

      <div id="inspector_bloom_controls" style="${sceneSettings.bloom?.enabled ? '' : 'display:none;'}">
        <div class="param-row">
          <div class="slider-header"><label>Bloom Strength</label><span class="value-badge" id="val_bloom_strength">${Number(sceneSettings.bloom?.strength !== undefined ? sceneSettings.bloom.strength : 0.6).toFixed(2)}</span></div>
          <input id="prop_scene_bloom_strength" type="range" min="0" max="3.0" step="0.05" value="${sceneSettings.bloom?.strength !== undefined ? sceneSettings.bloom.strength : 0.6}">
        </div>

        <div class="param-row">
          <div class="slider-header"><label>Bloom Radius</label><span class="value-badge" id="val_bloom_radius">${Number(sceneSettings.bloom?.radius !== undefined ? sceneSettings.bloom.radius : 0.4).toFixed(2)}</span></div>
          <input id="prop_scene_bloom_radius" type="range" min="0" max="2.0" step="0.05" value="${sceneSettings.bloom?.radius !== undefined ? sceneSettings.bloom.radius : 0.4}">
        </div>

        <div class="param-row">
          <div class="slider-header"><label>Bloom Threshold</label><span class="value-badge" id="val_bloom_threshold">${Number(sceneSettings.bloom?.threshold !== undefined ? sceneSettings.bloom.threshold : 0.85).toFixed(2)}</span></div>
          <input id="prop_scene_bloom_threshold" type="range" min="0" max="2.0" step="0.05" value="${sceneSettings.bloom?.threshold !== undefined ? sceneSettings.bloom.threshold : 0.85}">
        </div>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Cycles Rendering &amp; Shadows</div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_shadows" type="checkbox" ${rendering.shadows !== false ? "checked" : ""}>
          Enable Physically Soft Shadows
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

    <div class="section-group">
      <div class="section-group-title">Viewer &amp; Embed Floating Buttons</div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_btn_explode" type="checkbox" ${sceneSettings.controls?.explodeEnabled !== false ? "checked" : ""}>
          Enable "Explode" View Button
        </label>
      </div>

      <div class="param-row-checkbox">
        <label>
          <input id="prop_scene_btn_simulator" type="checkbox" ${sceneSettings.controls?.simulatorEnabled !== false ? "checked" : ""}>
          Enable "Simulator" Button
        </label>
      </div>

      <div id="simulator_btn_options_box" style="${sceneSettings.controls?.simulatorEnabled !== false ? '' : 'display:none;'} margin-top:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:6px; border:1px solid var(--border, #333);">
        <div class="param-row">
          <label>Link URL (optional)</label>
          <input id="prop_sim_btn_url" type="url" value="${escapeHTML(sceneSettings.controls?.simulatorUrl || "")}" placeholder="https://example.com/simulator">
        </div>

        <div class="param-row">
          <label>Parent JS Function Name (optional)</label>
          <input id="prop_sim_btn_fn" type="text" value="${escapeHTML(sceneSettings.controls?.simulatorJsFunction || "onSimulatorToggle")}" placeholder="onSimulatorToggle">
          <div style="font-size:10px; color:var(--text-dim, #888); margin-top:3px;">
            Calls function on parent page outside embed iframe or dispatches message.
          </div>
        </div>
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Hotspots &amp; Connector Line (Global)</div>

      <div class="param-row-flex">
        <label>Panel Background Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_panel_color" type="color" value="${(sceneSettings.hotspots?.panelColor || '#1e1e24').startsWith('#') ? (sceneSettings.hotspots?.panelColor || '#1e1e24') : '#1e1e24'}">
          <input id="prop_hotspot_panel_color_text" type="text" value="${sceneSettings.hotspots?.panelColor || 'rgba(30, 30, 35, 0.92)'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row-flex">
        <label>Title Font Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_title_font_color" type="color" value="${(sceneSettings.hotspots?.titleFontColor || '#ffffff').startsWith('#') ? (sceneSettings.hotspots?.titleFontColor || '#ffffff') : '#ffffff'}">
          <input id="prop_hotspot_title_font_color_text" type="text" value="${sceneSettings.hotspots?.titleFontColor || '#ffffff'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
      <div class="param-row">
        <div class="slider-header"><label>Title Font Size (px)</label><span class="value-badge" id="val_hotspot_title_font_size">${sceneSettings.hotspots?.titleFontSize || 14}</span></div>
        <input id="prop_hotspot_title_font_size" type="range" min="10" max="24" step="1" value="${sceneSettings.hotspots?.titleFontSize || 14}">
      </div>

      <div class="param-row-flex">
        <label>Description Font Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_desc_font_color" type="color" value="${(sceneSettings.hotspots?.descFontColor || '#e0e0e0').startsWith('#') ? (sceneSettings.hotspots?.descFontColor || '#e0e0e0') : '#e0e0e0'}">
          <input id="prop_hotspot_desc_font_color_text" type="text" value="${sceneSettings.hotspots?.descFontColor || '#e0e0e0'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
      <div class="param-row">
        <div class="slider-header"><label>Description Font Size (px)</label><span class="value-badge" id="val_hotspot_desc_font_size">${sceneSettings.hotspots?.descFontSize || 12.5}</span></div>
        <input id="prop_hotspot_desc_font_size" type="range" min="9" max="20" step="0.5" value="${sceneSettings.hotspots?.descFontSize || 12.5}">
      </div>

      <div class="param-row-flex">
        <label>List Font Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_hotspot_list_font_color" type="color" value="${(sceneSettings.hotspots?.listFontColor || '#cccccc').startsWith('#') ? (sceneSettings.hotspots?.listFontColor || '#cccccc') : '#cccccc'}">
          <input id="prop_hotspot_list_font_color_text" type="text" value="${sceneSettings.hotspots?.listFontColor || '#cccccc'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>
      <div class="param-row">
        <div class="slider-header"><label>List Font Size (px)</label><span class="value-badge" id="val_hotspot_list_font_size">${sceneSettings.hotspots?.listFontSize || 11}</span></div>
        <input id="prop_hotspot_list_font_size" type="range" min="8" max="18" step="0.5" value="${sceneSettings.hotspots?.listFontSize || 11}">
      </div>

      <div class="param-row">
        <label>Connector Line Style</label>
        <select id="prop_line_style" class="inspector-select">
          <option value="dashed" ${(sceneSettings.line?.style || 'dashed') === 'dashed' ? 'selected' : ''}>Broken / Dashed Line</option>
          <option value="solid" ${sceneSettings.line?.style === 'solid' ? 'selected' : ''}>Solid Line</option>
        </select>
      </div>

      <div class="param-row-flex">
        <label>Connector Line Color</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input id="prop_line_color" type="color" value="${(sceneSettings.line?.color || '#44D62C').startsWith('#') ? (sceneSettings.line?.color || '#44D62C') : '#44D62C'}">
          <input id="prop_line_color_text" type="text" value="${sceneSettings.line?.color || '#44D62C'}" style="width:130px; padding:4px 6px; font-size:11px; font-family:monospace; background:var(--bg-input, #1b1b22); color:var(--text, #eee); border:1px solid var(--border, #333); border-radius:4px;">
        </div>
      </div>

      <div class="param-row">
        <div class="slider-header"><label>Connector Line Width</label><span class="value-badge" id="val_line_width">${Number(sceneSettings.line?.width || 1.5).toFixed(1)}px</span></div>
        <input id="prop_line_width" type="range" min="1" max="6" step="0.5" value="${sceneSettings.line?.width || 1.5}">
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

  // Model-specific rotation & slider controls
  if (type === "model" && object) {
    const modelRotX = document.getElementById("prop_model_rot_x");
    const modelRotY = document.getElementById("prop_model_rot_y");
    const modelRotZ = document.getElementById("prop_model_rot_z");
    const sliderX = document.getElementById("prop_model_rot_slider_x");
    const sliderY = document.getElementById("prop_model_rot_slider_y");
    const sliderZ = document.getElementById("prop_model_rot_slider_z");
    const valX = document.getElementById("val_model_rot_x");
    const valY = document.getElementById("val_model_rot_y");
    const valZ = document.getElementById("val_model_rot_z");

    const updateModelRotationFromInputs = () => {
      const degX = parseFloat(modelRotX?.value || 0);
      const degY = parseFloat(modelRotY?.value || 0);
      const degZ = parseFloat(modelRotZ?.value || 0);
      object.rotation.set(
        THREE.MathUtils.degToRad(degX),
        THREE.MathUtils.degToRad(degY),
        THREE.MathUtils.degToRad(degZ)
      );
      if (sliderX && parseFloat(sliderX.value) !== Math.round(degX)) sliderX.value = Math.round(degX);
      if (sliderY && parseFloat(sliderY.value) !== Math.round(degY)) sliderY.value = Math.round(degY);
      if (sliderZ && parseFloat(sliderZ.value) !== Math.round(degZ)) sliderZ.value = Math.round(degZ);
      if (valX) valX.textContent = `${degX.toFixed(1)}°`;
      if (valY) valY.textContent = `${degY.toFixed(1)}°`;
      if (valZ) valZ.textContent = `${degZ.toFixed(1)}°`;
    };

    [modelRotX, modelRotY, modelRotZ].forEach((el) => el?.addEventListener("input", updateModelRotationFromInputs));

    const updateModelRotationFromSliders = () => {
      const degX = parseFloat(sliderX?.value || 0);
      const degY = parseFloat(sliderY?.value || 0);
      const degZ = parseFloat(sliderZ?.value || 0);
      object.rotation.set(
        THREE.MathUtils.degToRad(degX),
        THREE.MathUtils.degToRad(degY),
        THREE.MathUtils.degToRad(degZ)
      );
      if (modelRotX && parseFloat(modelRotX.value) !== degX) modelRotX.value = degX.toFixed(1);
      if (modelRotY && parseFloat(modelRotY.value) !== degY) modelRotY.value = degY.toFixed(1);
      if (modelRotZ && parseFloat(modelRotZ.value) !== degZ) modelRotZ.value = degZ.toFixed(1);
      if (valX) valX.textContent = `${degX.toFixed(1)}°`;
      if (valY) valY.textContent = `${degY.toFixed(1)}°`;
      if (valZ) valZ.textContent = `${degZ.toFixed(1)}°`;
    };

    [sliderX, sliderY, sliderZ].forEach((el) => el?.addEventListener("input", updateModelRotationFromSliders));

    document.getElementById("btn_reset_model_rot")?.addEventListener("click", () => {
      object.rotation.set(0, 0, 0);
      if (modelRotX) modelRotX.value = "0.0";
      if (modelRotY) modelRotY.value = "0.0";
      if (modelRotZ) modelRotZ.value = "0.0";
      if (sliderX) sliderX.value = "0";
      if (sliderY) sliderY.value = "0";
      if (sliderZ) sliderZ.value = "0";
      if (valX) valX.textContent = "0.0°";
      if (valY) valY.textContent = "0.0°";
      if (valZ) valZ.textContent = "0.0°";
    });

    document.getElementById("btn_frame_model_inspector")?.addEventListener("click", () => {
      frameModel(object);
    });
  }

  // Type specific bindings
  if (type === "hotspot") {
    const titleInput = document.getElementById("prop_hotspot_title");
    const descInput = document.getElementById("prop_hotspot_desc");
    const panelX = document.getElementById("prop_panel_x");
    const panelY = document.getElementById("prop_panel_y");

    if (!Array.isArray(object.listItems)) {
      object.listItems = [];
    }
    if (!object.button) {
      object.button = { enabled: false, text: "Show Article", url: "", jsFunction: "" };
    }

    titleInput?.addEventListener("input", (e) => {
      object.title = e.target.value;
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    descInput?.addEventListener("input", (e) => {
      object.description = e.target.value;
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    // List items handlers
    document.getElementById("btnAddHotspotListItem")?.addEventListener("click", () => {
      if (!Array.isArray(object.listItems)) object.listItems = [];
      object.listItems.push("");
      renderInspector();
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    document.querySelectorAll(".hotspot-list-item-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.dataset.itemIdx, 10);
        if (!isNaN(idx) && object.listItems) {
          object.listItems[idx] = e.target.value;
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    document.querySelectorAll(".btn-delete-list-item").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(btn.dataset.itemIdx, 10);
        if (!isNaN(idx) && object.listItems) {
          object.listItems.splice(idx, 1);
          renderInspector();
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Hotspot button handlers
    const btnEnable = document.getElementById("prop_hotspot_btn_enable");
    const btnOptionsBox = document.getElementById("hotspot_btn_options_box");
    const btnText = document.getElementById("prop_hotspot_btn_text");
    const btnUrl = document.getElementById("prop_hotspot_btn_url");
    const btnFn = document.getElementById("prop_hotspot_btn_fn");

    btnEnable?.addEventListener("change", (e) => {
      if (!object.button) object.button = { enabled: false, text: "Show Article", url: "", jsFunction: "" };
      object.button.enabled = Boolean(e.target.checked);
      if (btnOptionsBox) btnOptionsBox.style.display = object.button.enabled ? "" : "none";
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    btnText?.addEventListener("input", (e) => {
      if (!object.button) object.button = { enabled: false, text: "Show Article", url: "", jsFunction: "" };
      object.button.text = e.target.value || "Show Article";
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    btnUrl?.addEventListener("input", (e) => {
      if (!object.button) object.button = { enabled: false, text: "Show Article", url: "", jsFunction: "" };
      object.button.url = e.target.value;
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    btnFn?.addEventListener("input", (e) => {
      if (!object.button) object.button = { enabled: false, text: "Show Article", url: "", jsFunction: "" };
      object.button.jsFunction = e.target.value;
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

    const lightRadius = document.getElementById("prop_light_radius");
    const areaWidth = document.getElementById("prop_area_width");
    const areaHeight = document.getElementById("prop_area_height");

    // Kelvin buttons
    document.querySelectorAll(".kelvin-pill-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hex = btn.getAttribute("data-hex");
        if (hex) {
          object.color = hex;
          if (object.light) object.light.color.set(hex);
          if (lightColor) lightColor.value = hex;
        }
      });
    });

    lightRadius?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      object.radius = val;
      if (object.light?.shadow) {
        object.light.shadow.radius = val;
      }
      const valBadge = document.getElementById("light_radius_val");
      if (valBadge) valBadge.textContent = val.toFixed(1);
    });

    areaWidth?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) || 0.1;
      object.width = val;
      if (object.light) {
        object.light.width = val;
        if (object.helper) object.helper.update?.();
      }
    });

    areaHeight?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value) || 0.1;
      object.height = val;
      if (object.light) {
        object.light.height = val;
        if (object.helper) object.helper.update?.();
      }
    });

    // Preset buttons
    document.querySelectorAll(".light-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const presetKey = btn.getAttribute("data-preset");
        if (presetKey) {
          applyLightingPreset(presetKey);
        }
      });
    });

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

    const camMinPitch = document.getElementById("prop_cam_min_pitch");
    const camMinPitchNum = document.getElementById("prop_cam_min_pitch_num");
    const camMaxPitch = document.getElementById("prop_cam_max_pitch");
    const camMaxPitchNum = document.getElementById("prop_cam_max_pitch_num");

    const updateCamMinPitch = (val) => {
      let num = parseInt(val, 10);
      if (isNaN(num)) return;
      num = Math.max(-89, Math.min(89, num));
      if (state.cameraRig) {
        state.cameraRig.setMinPitch(num, true);
      }
      if (state.cameraSettings) state.cameraSettings.minPitch = num;
      if (!state.sceneDocument) state.sceneDocument = {};
      if (!state.sceneDocument.camera) state.sceneDocument.camera = {};
      state.sceneDocument.camera.minPitch = num;

      if (camMinPitch && parseInt(camMinPitch.value, 10) !== num && num <= 0 && num >= -89) camMinPitch.value = num;
      if (camMinPitchNum && parseInt(camMinPitchNum.value, 10) !== num) camMinPitchNum.value = num;
      const badge = document.getElementById("val_cam_min_pitch");
      if (badge) badge.textContent = `${num}°`;
    };

    const updateCamMaxPitch = (val) => {
      let num = parseInt(val, 10);
      if (isNaN(num)) return;
      num = Math.max(-89, Math.min(89, num));
      if (state.cameraRig) {
        state.cameraRig.setMaxPitch(num, true);
      }
      if (state.cameraSettings) state.cameraSettings.maxPitch = num;
      if (!state.sceneDocument) state.sceneDocument = {};
      if (!state.sceneDocument.camera) state.sceneDocument.camera = {};
      state.sceneDocument.camera.maxPitch = num;

      if (camMaxPitch && parseInt(camMaxPitch.value, 10) !== num && num >= 0 && num <= 89) camMaxPitch.value = num;
      if (camMaxPitchNum && parseInt(camMaxPitchNum.value, 10) !== num) camMaxPitchNum.value = num;
      const badge = document.getElementById("val_cam_max_pitch");
      if (badge) badge.textContent = `${num > 0 ? `+${num}` : num}°`;
    };

    camMinPitch?.addEventListener("input", (e) => updateCamMinPitch(e.target.value));
    camMinPitchNum?.addEventListener("input", (e) => updateCamMinPitch(e.target.value));
    camMaxPitch?.addEventListener("input", (e) => updateCamMaxPitch(e.target.value));
    camMaxPitchNum?.addEventListener("input", (e) => updateCamMaxPitch(e.target.value));

    document.querySelectorAll(".inspector-pitch-preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const minP = parseInt(btn.dataset.min, 10);
        const maxP = parseInt(btn.dataset.max, 10);
        updateCamMinPitch(minP);
        updateCamMaxPitch(maxP);
      });
    });

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
          minPitch: state.cameraRig.getMinPitchDeg(),
          maxPitch: state.cameraRig.getMaxPitchDeg(),
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

        const curMinPitch = state.cameraRig.getMinPitchDeg();
        const curMaxPitch = state.cameraRig.getMaxPitchDeg();
        const minPitchBadge = document.getElementById("val_cam_min_pitch");
        if (minPitchBadge) minPitchBadge.textContent = `${curMinPitch}°`;
        if (camMinPitch && curMinPitch <= 0 && curMinPitch >= -89) camMinPitch.value = curMinPitch;
        if (camMinPitchNum) camMinPitchNum.value = curMinPitch;
        const maxPitchBadge = document.getElementById("val_cam_max_pitch");
        if (maxPitchBadge) maxPitchBadge.textContent = `${curMaxPitch > 0 ? `+${curMaxPitch}` : curMaxPitch}°`;
        if (camMaxPitch && curMaxPitch >= 0 && curMaxPitch <= 89) camMaxPitch.value = curMaxPitch;
        if (camMaxPitchNum) camMaxPitchNum.value = curMaxPitch;
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

    const lookSelect = document.getElementById("prop_scene_look");
    const exposureEV = document.getElementById("prop_scene_exposure_ev");

    lookSelect?.addEventListener("change", (e) => {
      state.sceneSettings.environment.look = e.target.value;
      applyEnvironmentParams();
    });

    exposureEV?.addEventListener("input", (e) => {
      const evVal = parseFloat(e.target.value);
      state.sceneSettings.environment.exposureEV = evVal;
      // Linear exposure = 2^EV
      const linearExposure = Math.pow(2, evVal);
      state.sceneSettings.environment.exposure = linearExposure;
      applyEnvironmentParams();
      const badge = document.getElementById("val_exposure_ev");
      if (badge) badge.textContent = `${evVal >= 0 ? "+" : ""}${evVal.toFixed(2)} EV`;
    });

    exposure?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.sceneSettings.environment.exposure = val;
      state.sceneSettings.environment.exposureEV = Math.log2(Math.max(0.01, val));
      applyEnvironmentParams();
      const badge = document.getElementById("val_exposure");
      if (badge) badge.textContent = val.toFixed(1);
    });

    shadows?.addEventListener("change", (e) => {
      setShadowsEnabled(e.target.checked);
    });

    // Bloom & Post-processing handlers
    const bloomEnable = document.getElementById("prop_scene_bloom_enable");
    const bloomControls = document.getElementById("inspector_bloom_controls");
    const bloomStrength = document.getElementById("prop_scene_bloom_strength");
    const bloomRadius = document.getElementById("prop_scene_bloom_radius");
    const bloomThreshold = document.getElementById("prop_scene_bloom_threshold");

    bloomEnable?.addEventListener("change", (e) => {
      const enabled = Boolean(e.target.checked);
      setBloomEnabled(enabled);
      if (bloomControls) bloomControls.style.display = enabled ? "" : "none";
      // Also synchronize Environment tab checkbox if present
      const envTabBloom = document.getElementById("envTabBloomEnabled");
      if (envTabBloom) envTabBloom.checked = enabled;
      const envTabControls = document.getElementById("envTabBloomControls");
      if (envTabControls) envTabControls.style.display = enabled ? "" : "none";
    });

    bloomStrength?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      applyBloomSettings({ strength: val });
      const badge = document.getElementById("val_bloom_strength");
      if (badge) badge.textContent = val.toFixed(2);
      const envTabStrength = document.getElementById("envTabBloomStrength");
      if (envTabStrength) envTabStrength.value = val;
      const envTabStrengthVal = document.getElementById("envTabBloomStrengthVal");
      if (envTabStrengthVal) envTabStrengthVal.textContent = val.toFixed(2);
    });

    bloomRadius?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      applyBloomSettings({ radius: val });
      const badge = document.getElementById("val_bloom_radius");
      if (badge) badge.textContent = val.toFixed(2);
      const envTabRadius = document.getElementById("envTabBloomRadius");
      if (envTabRadius) envTabRadius.value = val;
      const envTabRadiusVal = document.getElementById("envTabBloomRadiusVal");
      if (envTabRadiusVal) envTabRadiusVal.textContent = val.toFixed(2);
    });

    bloomThreshold?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      applyBloomSettings({ threshold: val });
      const badge = document.getElementById("val_bloom_threshold");
      if (badge) badge.textContent = val.toFixed(2);
      const envTabThreshold = document.getElementById("envTabBloomThreshold");
      if (envTabThreshold) envTabThreshold.value = val;
      const envTabThresholdVal = document.getElementById("envTabBloomThresholdVal");
      if (envTabThresholdVal) envTabThresholdVal.textContent = val.toFixed(2);
    });

    grid?.addEventListener("change", (e) => {
      setGridVisible(e.target.checked);
    });

    axes?.addEventListener("change", (e) => {
      setAxesVisible(e.target.checked);
    });

    // Scene viewer controls checkboxes
    const btnExplodeCheck = document.getElementById("prop_scene_btn_explode");
    const btnSimCheck = document.getElementById("prop_scene_btn_simulator");
    const simBox = document.getElementById("simulator_btn_options_box");
    const simUrl = document.getElementById("prop_sim_btn_url");
    const simFn = document.getElementById("prop_sim_btn_fn");

    btnExplodeCheck?.addEventListener("change", (e) => {
      if (!state.sceneSettings.controls) {
        state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
      }
      state.sceneSettings.controls.explodeEnabled = Boolean(e.target.checked);
    });

    btnSimCheck?.addEventListener("change", (e) => {
      if (!state.sceneSettings.controls) {
        state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
      }
      const enabled = Boolean(e.target.checked);
      state.sceneSettings.controls.simulatorEnabled = enabled;
      if (simBox) simBox.style.display = enabled ? "" : "none";
    });

    simUrl?.addEventListener("input", (e) => {
      if (!state.sceneSettings.controls) {
        state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
      }
      state.sceneSettings.controls.simulatorUrl = e.target.value;
    });

    simFn?.addEventListener("input", (e) => {
      if (!state.sceneSettings.controls) {
        state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
      }
      state.sceneSettings.controls.simulatorJsFunction = e.target.value;
    });
  }

  // Global Hotspot & Line controls (available when inspecting a hotspot or the scene)
  const panelColorPicker = document.getElementById("prop_hotspot_panel_color");
  const panelColorText = document.getElementById("prop_hotspot_panel_color_text");
  const titleFontColorPicker = document.getElementById("prop_hotspot_title_font_color");
  const titleFontColorText = document.getElementById("prop_hotspot_title_font_color_text");
  const titleFontSizeSlider = document.getElementById("prop_hotspot_title_font_size");
  const valTitleFontSize = document.getElementById("val_hotspot_title_font_size");
  
  const descFontColorPicker = document.getElementById("prop_hotspot_desc_font_color");
  const descFontColorText = document.getElementById("prop_hotspot_desc_font_color_text");
  const descFontSizeSlider = document.getElementById("prop_hotspot_desc_font_size");
  const valDescFontSize = document.getElementById("val_hotspot_desc_font_size");
  
  const listFontColorPicker = document.getElementById("prop_hotspot_list_font_color");
  const listFontColorText = document.getElementById("prop_hotspot_list_font_color_text");
  const listFontSizeSlider = document.getElementById("prop_hotspot_list_font_size");
  const valListFontSize = document.getElementById("val_hotspot_list_font_size");
  const lineStyleSelect = document.getElementById("prop_line_style");
  const lineColorPicker = document.getElementById("prop_line_color");
  const lineColorText = document.getElementById("prop_line_color_text");
  const lineWidthSlider = document.getElementById("prop_line_width");
  const valLineWidth = document.getElementById("val_line_width");

  const applyGlobalHotspotSettings = () => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    if (!state.sceneDocument) state.sceneDocument = {};
    if (!state.sceneDocument.settings) state.sceneDocument.settings = state.sceneSettings;
    state.sceneDocument.settings.hotspots = state.sceneSettings.hotspots;
    state.sceneDocument.settings.line = state.sceneSettings.line;

    const panelBg = state.sceneSettings.hotspots.panelColor;
    const titleFontColor = state.sceneSettings.hotspots.titleFontColor || "#ffffff";
    const titleFontSize = Number(state.sceneSettings.hotspots.titleFontSize || 14);
    const descFontColor = state.sceneSettings.hotspots.descFontColor || "#e0e0e0";
    const descFontSize = Number(state.sceneSettings.hotspots.descFontSize || 12.5);
    const listFontColor = state.sceneSettings.hotspots.listFontColor || "#cccccc";
    const listFontSize = Number(state.sceneSettings.hotspots.listFontSize || 11);

    const lStyle = state.sceneSettings.line.style || "dashed";
    const lColor = state.sceneSettings.line.color || "#44D62C";
    const lWidth = Number(state.sceneSettings.line.width || 1.5);

    // Update all hotspot panels in editor
    document.querySelectorAll(".panel").forEach((p) => {
      if (panelBg) p.style.backgroundColor = panelBg;
      
      const titleEl = p.querySelector(".panel-title");
      if (titleEl) {
        titleEl.style.color = titleFontColor;
        titleEl.style.fontSize = `${titleFontSize}px`;
      }
      
      const descEl = p.querySelector(".panel-desc");
      if (descEl) {
        descEl.style.color = descFontColor;
        descEl.style.fontSize = `${descFontSize}px`;
      }

      p.querySelectorAll(".panel-list-item").forEach((li) => {
        li.style.color = listFontColor;
        li.style.fontSize = `${listFontSize}px`;
      });
    });

    // Update all SVG connector lines in editor
    document.querySelectorAll("svg line").forEach((l) => {
      l.setAttribute("stroke", lColor);
      l.setAttribute("stroke-width", String(lWidth));
      l.style.stroke = lColor;
      l.style.strokeWidth = `${lWidth}px`;
      if (lStyle === "solid") {
        l.classList.remove("dashed-line");
        l.classList.add("solid-line");
        l.style.strokeDasharray = "none";
        l.style.animation = "none";
      } else {
        l.classList.remove("solid-line");
        l.classList.add("dashed-line");
        l.style.strokeDasharray = "4, 3";
        l.style.animation = "dash 1s linear infinite";
      }
    });
  };

  panelColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.panelColor = e.target.value;
    if (panelColorText) panelColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  panelColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.panelColor = e.target.value;
    if (panelColorPicker && e.target.value.startsWith("#")) panelColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  titleFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.titleFontColor = e.target.value;
    if (titleFontColorText) titleFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  titleFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.titleFontColor = e.target.value;
    if (titleFontColorPicker && e.target.value.startsWith("#")) titleFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  titleFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.titleFontSize = Number(e.target.value);
    if (valTitleFontSize) valTitleFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
  });

  descFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.descFontColor = e.target.value;
    if (descFontColorText) descFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  descFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.descFontColor = e.target.value;
    if (descFontColorPicker && e.target.value.startsWith("#")) descFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  descFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.descFontSize = Number(e.target.value);
    if (valDescFontSize) valDescFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
  });

  listFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.listFontColor = e.target.value;
    if (listFontColorText) listFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  listFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.listFontColor = e.target.value;
    if (listFontColorPicker && e.target.value.startsWith("#")) listFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  listFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.listFontSize = Number(e.target.value);
    if (valListFontSize) valListFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
  });

  lineStyleSelect?.addEventListener("change", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.style = e.target.value;
    applyGlobalHotspotSettings();
  });

  lineColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.color = e.target.value;
    if (lineColorText) lineColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  lineColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.color = e.target.value;
    if (lineColorPicker && e.target.value.startsWith("#")) lineColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  lineWidthSlider?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.width = val;
    if (valLineWidth) valLineWidth.textContent = `${val.toFixed(1)}px`;
    applyGlobalHotspotSettings();
  });
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
