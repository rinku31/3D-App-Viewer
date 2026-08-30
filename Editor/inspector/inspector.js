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
  
  if (!Array.isArray(hotspot.paragraphs)) {
    if (Array.isArray(hotspot.sections)) {
      hotspot.paragraphs = hotspot.sections;
    } else {
      hotspot.paragraphs = [];
      if (hotspot.description || (hotspot.listItems && hotspot.listItems.length > 0) || (hotspot.button && hotspot.button.enabled)) {
        hotspot.paragraphs.push({
          id: "para_" + Date.now(),
          text: hotspot.description || "",
          listItems: Array.isArray(hotspot.listItems) ? [...hotspot.listItems] : [],
          buttons: hotspot.button ? [{
            enabled: Boolean(hotspot.button.enabled),
            text: hotspot.button.text || "Show Article",
            url: hotspot.button.url || "",
            jsFunction: hotspot.button.jsFunction || ""
          }] : []
        });
      }
    }
  }

  hotspot.sections = hotspot.paragraphs;
  const paragraphs = hotspot.paragraphs;

  return `
    ${buildHeader("HOTSPOT", hotspot.title || "Hotspot", true)}

    <div class="section">
      <label>Title</label>
      <input id="prop_hotspot_title" type="text" value="${escapeHTML(hotspot.title)}" placeholder="Hotspot Title">
    </div>

    <div class="section-group">
      <div class="section-group-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Hotspot Paragraphs (${paragraphs.length})</span>
        <button id="btnAddHotspotParagraph" class="secondary" style="font-size:10px; padding:3px 8px; cursor:pointer;">+ Add Paragraph</button>
      </div>

      <div id="hotspot_paragraphs_container" style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
        ${paragraphs.length === 0 ? `
          <div style="font-size:11px; color:var(--text-dim, #888); font-style:italic; padding:8px 0; text-align:center; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.12); border-radius:6px;">
            No paragraphs yet. Click "+ Add Paragraph" to add content.
          </div>
        ` : paragraphs.map((p, pIdx) => {
          const pList = Array.isArray(p.listItems) ? p.listItems : [];
          const pBtns = Array.isArray(p.buttons) ? p.buttons : (p.button ? [p.button] : []);
          const pText = p.text !== undefined ? p.text : (p.description !== undefined ? p.description : "");

          return `
            <div class="hotspot-paragraph-card" data-para-idx="${pIdx}" style="background:rgba(25, 25, 30, 0.7); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:10px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">
                <span style="font-size:11px; font-weight:700; color:var(--accent, #44D62C); text-transform:uppercase; letter-spacing:0.5px;">Paragraph ${pIdx + 1}</span>
                <button class="delete-btn btn-delete-paragraph" data-para-idx="${pIdx}" title="Delete Paragraph" style="padding:2px 6px; font-size:11px;">&#128465;</button>
              </div>

              <div>
                <label style="font-size:10.5px; color:var(--text-dim, #999); margin-bottom:2px; display:block;">Paragraph Text</label>
                <textarea class="prop-para-text" data-para-idx="${pIdx}" rows="3" placeholder="Paragraph description text..." style="font-size:12px; padding:5px 8px; margin-bottom:0;">${escapeHTML(pText)}</textarea>
              </div>

              <!-- Paragraph List Items -->
              <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.06); border-radius:4px; padding:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:10.5px; font-weight:600; color:#ddd;">List Items (${pList.length})</span>
                  <button class="secondary btn-add-para-list-item" data-para-idx="${pIdx}" style="font-size:9.5px; padding:2px 6px;">+ Add Item</button>
                </div>
                <div class="para-list-items-container" data-para-idx="${pIdx}" style="display:flex; flex-direction:column; gap:4px;">
                  ${pList.length === 0 ? `
                    <div style="font-size:10px; color:var(--text-dim, #777); font-style:italic;">No list items in this paragraph.</div>
                  ` : pList.map((item, iIdx) => `
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span style="font-size:11px; color:var(--accent, #44D62C);">&bull;</span>
                      <input type="text" class="prop-para-list-item-input" data-para-idx="${pIdx}" data-item-idx="${iIdx}" value="${escapeHTML(item)}" placeholder="Bullet point item..." style="flex:1; font-size:11px; padding:4px 6px; margin:0;">
                      <button class="delete-btn btn-delete-para-list-item" data-para-idx="${pIdx}" data-item-idx="${iIdx}" title="Remove item" style="padding:2px 5px; font-size:10px;">&#128465;</button>
                    </div>
                  `).join("")}
                </div>
              </div>

              <!-- Paragraph Action Buttons -->
              <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.06); border-radius:4px; padding:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-size:10.5px; font-weight:600; color:#ddd;">Action Buttons (${pBtns.length})</span>
                  <button class="secondary btn-add-para-btn" data-para-idx="${pIdx}" style="font-size:9.5px; padding:2px 6px;">+ Add Button</button>
                </div>
                <div class="para-buttons-container" data-para-idx="${pIdx}" style="display:flex; flex-direction:column; gap:6px;">
                  ${pBtns.length === 0 ? `
                    <div style="font-size:10px; color:var(--text-dim, #777); font-style:italic;">No action buttons in this paragraph.</div>
                  ` : pBtns.map((b, bIdx) => `
                    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:6px; display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label style="font-size:10.5px; display:flex; align-items:center; gap:4px; color:#eee; margin:0; cursor:pointer;">
                          <input type="checkbox" class="prop-para-btn-enable" data-para-idx="${pIdx}" data-btn-idx="${bIdx}" ${b.enabled !== false ? 'checked' : ''} style="margin:0; width:auto;">
                          <span>Enabled</span>
                        </label>
                        <button class="delete-btn btn-delete-para-btn" data-para-idx="${pIdx}" data-btn-idx="${bIdx}" title="Remove button" style="padding:1px 5px; font-size:10px;">&#128465;</button>
                      </div>
                      <div style="display:grid; grid-template-columns: 1fr; gap:4px;">
                        <input type="text" class="prop-para-btn-text" data-para-idx="${pIdx}" data-btn-idx="${bIdx}" value="${escapeHTML(b.text || 'Action')}" placeholder="Button Label" style="font-size:11px; padding:3px 6px; margin:0;">
                        <input type="url" class="prop-para-btn-url" data-para-idx="${pIdx}" data-btn-idx="${bIdx}" value="${escapeHTML(b.url || '')}" placeholder="Link URL (https://...)" style="font-size:11px; padding:3px 6px; margin:0;">
                        <input type="text" class="prop-para-btn-fn" data-para-idx="${pIdx}" data-btn-idx="${bIdx}" value="${escapeHTML(b.jsFunction || '')}" placeholder="JS Function Name (optional)" style="font-size:11px; padding:3px 6px; margin:0;">
                      </div>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>
          `;
        }).join("")}
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

  return `
    ${buildHeader("CAMERA", "Perspective Camera")}

    <div class="section-group">
      <div class="section-group-title">Camera Settings &amp; Navigation Limits</div>
      <button id="btnInspectorGotoCamSettings" class="primary-btn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:9px 12px; font-size:12px; font-weight:700;">
        &#9881; Configure Camera Limits &amp; Default View
      </button>
      <div style="font-size:11px; color:var(--text-dim, #888); margin-top:6px; line-height:1.4;">
        Default capture view, vertical pitch clamping (-89° to +89°), and zoom distance limits are configured in the <b>Settings</b> tab.
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

    <div class="section-group">
      <div class="section-group-title">Orbit Target (LookAt Center)</div>
      <div class="param-row">
        <div class="vector3-inputs">
          <div class="vec-item"><span class="vec-label x">X</span><input id="prop_cam_target_x" type="number" step="0.1" value="${target.x.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label y">Y</span><input id="prop_cam_target_y" type="number" step="0.1" value="${target.y.toFixed(2)}"></div>
          <div class="vec-item"><span class="vec-label z">Z</span><input id="prop_cam_target_z" type="number" step="0.1" value="${target.z.toFixed(2)}"></div>
        </div>
      </div>

      <div class="param-row-flex" style="margin-top:10px;">
        <label>Auto-Rotate Preview</label>
        <input id="prop_cam_autorotate" type="checkbox" ${state.cameraRig?.autoRotate ? "checked" : ""}>
      </div>
    </div>
  `;
}

function buildSceneInspector() {
  const modelName = state.currentModel?.name || (state.currentModel ? "Active 3D Model" : "None Loaded");
  const hotspotsCount = state.hotspots?.length || 0;
  const lightsCount = state.lights?.length || 0;
  const explodeCount = state.explodeNodes?.length || 0;

  return `
    ${buildHeader("SCENE ROOT", "Global Scene & Overview")}

    <div class="section-group">
      <div class="section-group-title">Configuration Panels</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button id="btnInspectorGotoSettings" class="primary-btn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 12px; font-size:12px; font-weight:700;">
          &#9881; Go to Scene Settings Tab
        </button>
        <button id="btnInspectorGotoEnv" class="secondary" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:9px 12px; font-size:12px; font-weight:600;">
          &#9728; Go to Environment &amp; Lighting Tab
        </button>
      </div>
      <div style="font-size:11px; color:var(--text-dim, #888); margin-top:8px; line-height:1.4;">
        Global hotspot card styling, viewer floating buttons, and camera orbit limits are managed in <b>Settings</b>. HDR world illumination, tone mapping, and shadows are in <b>Environment</b>.
      </div>
    </div>

    <div class="section-group">
      <div class="section-group-title">Scene Summary</div>
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="color:var(--text-dim, #999);">Active Model:</span>
          <span style="color:#eee; font-weight:500;">${escapeHTML(modelName)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="color:var(--text-dim, #999);">Hotspots:</span>
          <span style="color:var(--accent, #44D62C); font-weight:600;">${hotspotsCount}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="color:var(--text-dim, #999);">Cycles Lights:</span>
          <span style="color:#eee; font-weight:500;">${lightsCount}</span>
        </div>
        ${explodeCount > 0 ? `
        <div style="display:flex; justify-content:space-between; padding:4px 0;">
          <span style="color:var(--text-dim, #999);">Explode Meshes:</span>
          <span style="color:#eee; font-weight:500;">${explodeCount}</span>
        </div>
        ` : ""}
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
    const panelX = document.getElementById("prop_panel_x");
    const panelY = document.getElementById("prop_panel_y");

    if (!Array.isArray(object.paragraphs)) {
      object.paragraphs = Array.isArray(object.sections) ? object.sections : [];
    }
    object.sections = object.paragraphs;

    titleInput?.addEventListener("input", (e) => {
      object.title = e.target.value;
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    // Add Paragraph
    document.getElementById("btnAddHotspotParagraph")?.addEventListener("click", () => {
      if (!Array.isArray(object.paragraphs)) object.paragraphs = [];
      object.paragraphs.push({
        id: "para_" + Date.now(),
        text: "",
        listItems: [],
        buttons: []
      });
      object.sections = object.paragraphs;
      renderInspector();
      if (object.panel) updatePanelHTML(object, object.panel);
    });

    // Delete Paragraph
    document.querySelectorAll(".btn-delete-paragraph").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pIdx = parseInt(btn.dataset.paraIdx, 10);
        if (!isNaN(pIdx) && Array.isArray(object.paragraphs)) {
          object.paragraphs.splice(pIdx, 1);
          object.sections = object.paragraphs;
          renderInspector();
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Paragraph Text
    document.querySelectorAll(".prop-para-text").forEach((textarea) => {
      textarea.addEventListener("input", (e) => {
        const pIdx = parseInt(e.target.dataset.paraIdx, 10);
        if (!isNaN(pIdx) && object.paragraphs?.[pIdx]) {
          object.paragraphs[pIdx].text = e.target.value;
          object.paragraphs[pIdx].description = e.target.value;
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Add List Item
    document.querySelectorAll(".btn-add-para-list-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pIdx = parseInt(btn.dataset.paraIdx, 10);
        if (!isNaN(pIdx) && object.paragraphs?.[pIdx]) {
          if (!Array.isArray(object.paragraphs[pIdx].listItems)) object.paragraphs[pIdx].listItems = [];
          object.paragraphs[pIdx].listItems.push("");
          renderInspector();
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Edit List Item
    document.querySelectorAll(".prop-para-list-item-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const pIdx = parseInt(e.target.dataset.paraIdx, 10);
        const iIdx = parseInt(e.target.dataset.itemIdx, 10);
        if (!isNaN(pIdx) && !isNaN(iIdx) && object.paragraphs?.[pIdx]?.listItems) {
          object.paragraphs[pIdx].listItems[iIdx] = e.target.value;
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Delete List Item
    document.querySelectorAll(".btn-delete-para-list-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pIdx = parseInt(btn.dataset.paraIdx, 10);
        const iIdx = parseInt(btn.dataset.itemIdx, 10);
        if (!isNaN(pIdx) && !isNaN(iIdx) && object.paragraphs?.[pIdx]?.listItems) {
          object.paragraphs[pIdx].listItems.splice(iIdx, 1);
          renderInspector();
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Add Button
    document.querySelectorAll(".btn-add-para-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pIdx = parseInt(btn.dataset.paraIdx, 10);
        if (!isNaN(pIdx) && object.paragraphs?.[pIdx]) {
          if (!Array.isArray(object.paragraphs[pIdx].buttons)) object.paragraphs[pIdx].buttons = [];
          object.paragraphs[pIdx].buttons.push({
            enabled: true,
            text: "Action",
            url: "",
            jsFunction: ""
          });
          renderInspector();
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Button Toggle Enable
    document.querySelectorAll(".prop-para-btn-enable").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const pIdx = parseInt(e.target.dataset.paraIdx, 10);
        const bIdx = parseInt(e.target.dataset.btnIdx, 10);
        if (!isNaN(pIdx) && !isNaN(bIdx) && object.paragraphs?.[pIdx]?.buttons?.[bIdx]) {
          object.paragraphs[pIdx].buttons[bIdx].enabled = Boolean(e.target.checked);
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Button Text
    document.querySelectorAll(".prop-para-btn-text").forEach((input) => {
      input.addEventListener("input", (e) => {
        const pIdx = parseInt(e.target.dataset.paraIdx, 10);
        const bIdx = parseInt(e.target.dataset.btnIdx, 10);
        if (!isNaN(pIdx) && !isNaN(bIdx) && object.paragraphs?.[pIdx]?.buttons?.[bIdx]) {
          object.paragraphs[pIdx].buttons[bIdx].text = e.target.value;
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Button URL
    document.querySelectorAll(".prop-para-btn-url").forEach((input) => {
      input.addEventListener("input", (e) => {
        const pIdx = parseInt(e.target.dataset.paraIdx, 10);
        const bIdx = parseInt(e.target.dataset.btnIdx, 10);
        if (!isNaN(pIdx) && !isNaN(bIdx) && object.paragraphs?.[pIdx]?.buttons?.[bIdx]) {
          object.paragraphs[pIdx].buttons[bIdx].url = e.target.value;
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Button JS Function
    document.querySelectorAll(".prop-para-btn-fn").forEach((input) => {
      input.addEventListener("input", (e) => {
        const pIdx = parseInt(e.target.dataset.paraIdx, 10);
        const bIdx = parseInt(e.target.dataset.btnIdx, 10);
        if (!isNaN(pIdx) && !isNaN(bIdx) && object.paragraphs?.[pIdx]?.buttons?.[bIdx]) {
          object.paragraphs[pIdx].buttons[bIdx].jsFunction = e.target.value;
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
    });

    // Delete Button
    document.querySelectorAll(".btn-delete-para-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pIdx = parseInt(btn.dataset.paraIdx, 10);
        const bIdx = parseInt(btn.dataset.btnIdx, 10);
        if (!isNaN(pIdx) && !isNaN(bIdx) && object.paragraphs?.[pIdx]?.buttons) {
          object.paragraphs[pIdx].buttons.splice(bIdx, 1);
          renderInspector();
          if (object.panel) updatePanelHTML(object, object.panel);
        }
      });
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
    document.getElementById("btnInspectorGotoCamSettings")?.addEventListener("click", () => {
      showSidebarTab("settings");
    });

    const targetX = document.getElementById("prop_cam_target_x");
    const targetY = document.getElementById("prop_cam_target_y");
    const targetZ = document.getElementById("prop_cam_target_z");
    const camFov = document.getElementById("prop_cam_fov");
    const camNear = document.getElementById("prop_cam_near");
    const camFar = document.getElementById("prop_cam_far");

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

    const autoRotateToggle = document.getElementById("prop_cam_autorotate");
    autoRotateToggle?.addEventListener("change", (e) => {
      if (state.cameraRig) {
        state.cameraRig.autoRotate = Boolean(e.target.checked);
      }
    });
  } else if (type === "scene") {
    document.getElementById("btnInspectorGotoSettings")?.addEventListener("click", () => {
      showSidebarTab("settings");
    });
    document.getElementById("btnInspectorGotoEnv")?.addEventListener("click", () => {
      showSidebarTab("env");
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

  // Global button settings event listeners
  const btnBgColorPicker = document.getElementById("prop_hotspot_btn_bg_color");
  const btnBgColorText = document.getElementById("prop_hotspot_btn_bg_color_text");
  const btnFontColorPicker = document.getElementById("prop_hotspot_btn_font_color");
  const btnFontColorText = document.getElementById("prop_hotspot_btn_font_color_text");
  const btnFontSizeSlider = document.getElementById("prop_hotspot_btn_font_size");
  const valBtnFontSize = document.getElementById("val_hotspot_btn_font_size");
  const btnPaddingVInput = document.getElementById("prop_hotspot_btn_padding_v");
  const btnPaddingHInput = document.getElementById("prop_hotspot_btn_padding_h");
  const valBtnPadding = document.getElementById("val_hotspot_btn_padding");
  const btnMarginSlider = document.getElementById("prop_hotspot_btn_margin");
  const valBtnMargin = document.getElementById("val_hotspot_btn_margin");

  btnBgColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnBgColor = e.target.value;
    if (btnBgColorText) btnBgColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  btnBgColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnBgColor = e.target.value;
    if (btnBgColorPicker && e.target.value.startsWith("#")) btnBgColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  btnFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnFontColor = e.target.value;
    if (btnFontColorText) btnFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  btnFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnFontColor = e.target.value;
    if (btnFontColorPicker && e.target.value.startsWith("#")) btnFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
  });

  btnFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const val = Number(e.target.value);
    state.sceneSettings.hotspots.btnFontSize = val;
    if (valBtnFontSize) valBtnFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
  });

  const updatePadding = () => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const v = Number(btnPaddingVInput?.value || 5);
    const h = Number(btnPaddingHInput?.value || 12);
    state.sceneSettings.hotspots.btnPaddingV = v;
    state.sceneSettings.hotspots.btnPaddingH = h;
    if (valBtnPadding) valBtnPadding.textContent = `${v}px / ${h}px`;
    applyGlobalHotspotSettings();
  };

  btnPaddingVInput?.addEventListener("input", updatePadding);
  btnPaddingHInput?.addEventListener("input", updatePadding);

  btnMarginSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const val = Number(e.target.value);
    state.sceneSettings.hotspots.btnMargin = val;
    if (valBtnMargin) valBtnMargin.textContent = e.target.value;
    applyGlobalHotspotSettings();
  });
}

function applyGlobalHotspotSettings() {
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
  const btnBgColor = state.sceneSettings.hotspots.btnBgColor || "rgba(68, 214, 44, 0.28)";
  const btnFontColor = state.sceneSettings.hotspots.btnFontColor || "#ffffff";
  const btnFontSize = Number(state.sceneSettings.hotspots.btnFontSize || 11);
  const btnPaddingV = Number(state.sceneSettings.hotspots.btnPaddingV || 5);
  const btnPaddingH = Number(state.sceneSettings.hotspots.btnPaddingH || 12);
  const btnMargin = Number(state.sceneSettings.hotspots.btnMargin || 5);

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

    p.querySelectorAll(".panel-btn-group").forEach((grp) => {
      grp.style.display = "flex";
      grp.style.flexDirection = "column";
      grp.style.alignItems = "flex-end";
      grp.style.gap = `${btnMargin}px`;
      grp.style.marginTop = `${btnMargin}px`;
    });

    p.querySelectorAll(".panel-btn").forEach((b) => {
      b.style.display = "inline-flex";
      b.style.alignSelf = "flex-end";
      b.style.width = "auto";
      b.style.backgroundColor = btnBgColor;
      b.style.color = btnFontColor;
      b.style.fontSize = `${btnFontSize}px`;
      b.style.padding = `${btnPaddingV}px ${btnPaddingH}px`;
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
  renderInspector,
  applyGlobalHotspotSettings
};
