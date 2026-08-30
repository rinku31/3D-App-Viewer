import * as THREE from "three";

import { clearSelection, state } from "../state/state.js";
import { select, deselect } from "../selection/selection.js";
import { initializeGizmo } from "../gizmo/gizmo.js";
import { initializeHierarchy, renderHierarchy } from "../hierarchy/hierarchy.js";
import { initializeInspector, renderInspector, applyGlobalHotspotSettings } from "../inspector/inspector.js";
import {
  createHotspot,
  removeHotspot,
  updateHotspots
} from "../hotspots/hotspots.js";
import {
  applyLightingPreset,
  bindLightUI,
  deleteSelectedLight,
  updateLights
} from "../lights/lights.js";
import { bindIO } from "../io/io.js";
import { bindUI, showSidebarTab } from "../ui/ui.js";
import { initHistory, pushHistoryState, undo, redo } from "../state/history.js";
import {
  applyBackgroundSettings,
  applyBloomSettings,
  applyEnvironmentParams,
  loadEnvironment,
  resizeRenderer,
  setAxesVisible,
  setBloomEnabled,
  setGridVisible,
  setShadowsEnabled,
  startAnimation
} from "../render/render.js";

function syncEnvironmentTabUI() {
  const env = state.sceneSettings?.environment || {};
  const presetSelect = document.getElementById("envTabPreset");
  if (presetSelect && env.preset) presetSelect.value = env.preset;

  const intensityInput = document.getElementById("envTabIntensity");
  const intensityVal = document.getElementById("envTabIntensityVal");
  if (intensityInput) {
    const val = env.intensity ?? 1.0;
    intensityInput.value = val;
    if (intensityVal) intensityVal.textContent = Number(val).toFixed(1);
  }

  const rotInput = document.getElementById("envTabRotation");
  const rotVal = document.getElementById("envTabRotationVal");
  if (rotInput) {
    const val = env.rotation ?? 0;
    rotInput.value = val;
    if (rotVal) rotVal.textContent = `${Math.round(val)}°`;
  }

  // 1. Editor Workspace Backdrop
  const editorBg = state.editorBackground || { type: "color", color: "#222228", blur: 0 };
  const editorBgTypeSelect = document.getElementById("envTabEditorBgType");
  const editorBgColorRow = document.getElementById("envTabEditorBgColorRow");
  const editorBgBlurRow = document.getElementById("envTabEditorBgBlurRow");
  if (editorBgTypeSelect) {
    const bgType = editorBg.type || "color";
    editorBgTypeSelect.value = bgType;
    if (editorBgColorRow) editorBgColorRow.style.display = bgType === "transparent" ? "none" : "flex";
    if (editorBgBlurRow) editorBgBlurRow.style.display = bgType === "environment" ? "block" : "none";
  }

  const editorBgColorInput = document.getElementById("envTabEditorBgColor");
  const editorBgColorText = document.getElementById("envTabEditorBgColorText");
  if (editorBgColorInput && editorBg.color) {
    if (editorBg.color.startsWith("#")) editorBgColorInput.value = editorBg.color;
  }
  if (editorBgColorText && editorBg.color) {
    editorBgColorText.value = editorBg.color;
  }

  const editorBgBlurInput = document.getElementById("envTabEditorBgBlur");
  const editorBgBlurVal = document.getElementById("envTabEditorBgBlurVal");
  if (editorBgBlurInput) {
    const val = editorBg.blur || 0;
    editorBgBlurInput.value = val;
    if (editorBgBlurVal) editorBgBlurVal.textContent = Number(val).toFixed(2);
  }

  const toneSelect = document.getElementById("envTabToneMapping");
  if (toneSelect && env.toneMapping) {
    toneSelect.value = env.toneMapping;
  }

  const expInput = document.getElementById("envTabExposure");
  const expVal = document.getElementById("envTabExposureVal");
  if (expInput) {
    const val = env.exposure ?? 1.6;
    expInput.value = val;
    if (expVal) expVal.textContent = Number(val).toFixed(1);
  }

  const shadowsCheck = document.getElementById("envTabShadows");
  if (shadowsCheck) {
    shadowsCheck.checked = state.sceneSettings.rendering?.shadows !== false;
  }

  const gridCheck = document.getElementById("envTabGrid");
  if (gridCheck) {
    gridCheck.checked = state.sceneSettings.helpers?.grid !== false;
  }

  const axesCheck = document.getElementById("envTabAxes");
  if (axesCheck) {
    axesCheck.checked = Boolean(state.sceneSettings.helpers?.axes);
  }

  // Bloom Sync
  const bloomCheck = document.getElementById("envTabBloomEnabled");
  const bloomControls = document.getElementById("envTabBloomControls");
  const bloomStrength = document.getElementById("envTabBloomStrength");
  const bloomStrengthVal = document.getElementById("envTabBloomStrengthVal");
  const bloomRadius = document.getElementById("envTabBloomRadius");
  const bloomRadiusVal = document.getElementById("envTabBloomRadiusVal");
  const bloomThreshold = document.getElementById("envTabBloomThreshold");
  const bloomThresholdVal = document.getElementById("envTabBloomThresholdVal");

  const bloom = state.sceneSettings.bloom || {};
  if (bloomCheck) bloomCheck.checked = Boolean(bloom.enabled);
  if (bloomControls) bloomControls.style.display = bloom.enabled ? "block" : "none";
  if (bloomStrength) {
    bloomStrength.value = bloom.strength ?? 0.6;
    if (bloomStrengthVal) bloomStrengthVal.textContent = Number(bloom.strength ?? 0.6).toFixed(2);
  }
  if (bloomRadius) {
    bloomRadius.value = bloom.radius ?? 0.4;
    if (bloomRadiusVal) bloomRadiusVal.textContent = Number(bloom.radius ?? 0.4).toFixed(2);
  }
  if (bloomThreshold) {
    bloomThreshold.value = bloom.threshold ?? 0.85;
    if (bloomThresholdVal) bloomThresholdVal.textContent = Number(bloom.threshold ?? 0.85).toFixed(2);
  }
}

function bindEnvironmentTab() {
  window.addEventListener("editorselectionchange", syncEnvironmentTabUI);
  const scene = state.scene;
  const renderer = state.renderer;

  // Preset
  const presetSelect = document.getElementById("envTabPreset");
  if (presetSelect) {
    presetSelect.value = state.sceneSettings.environment?.preset || "studio_small_09";
    presetSelect.addEventListener("change", (e) => {
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.preset = e.target.value;
      loadEnvironment(e.target.value);
      pushHistoryState();
    });
  }

  // Intensity
  const intensityInput = document.getElementById("envTabIntensity");
  const intensityVal = document.getElementById("envTabIntensityVal");
  if (intensityInput) {
    intensityInput.value = state.sceneSettings.environment?.intensity ?? 1.0;
    intensityInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (intensityVal) intensityVal.textContent = val.toFixed(1);
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.intensity = val;
      applyEnvironmentParams();
      pushHistoryState();
    });
  }

  // Rotation
  const rotInput = document.getElementById("envTabRotation");
  const rotVal = document.getElementById("envTabRotationVal");
  if (rotInput) {
    rotInput.value = state.sceneSettings.environment?.rotation ?? 0;
    rotInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (rotVal) rotVal.textContent = `${Math.round(val)}°`;
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.rotation = val;
      applyEnvironmentParams();
      pushHistoryState();
    });
  }

  // 1. Editor Workspace Backdrop Listeners
  const editorBgTypeSelect = document.getElementById("envTabEditorBgType");
  const editorBgColorRow = document.getElementById("envTabEditorBgColorRow");
  const editorBgBlurRow = document.getElementById("envTabEditorBgBlurRow");
  if (editorBgTypeSelect) {
    editorBgTypeSelect.value = state.editorBackground?.type || "color";
    editorBgTypeSelect.addEventListener("change", (e) => {
      if (!state.editorBackground) state.editorBackground = {};
      state.editorBackground.type = e.target.value;
      if (editorBgColorRow) editorBgColorRow.style.display = e.target.value === "transparent" ? "none" : "flex";
      if (editorBgBlurRow) editorBgBlurRow.style.display = e.target.value === "environment" ? "block" : "none";
      applyBackgroundSettings();
      pushHistoryState();
    });
  }

  const editorBgColorInput = document.getElementById("envTabEditorBgColor");
  const editorBgColorText = document.getElementById("envTabEditorBgColorText");
  if (editorBgColorInput) {
    editorBgColorInput.value = state.editorBackground?.color || "#222228";
    editorBgColorInput.addEventListener("input", (e) => {
      if (!state.editorBackground) state.editorBackground = {};
      state.editorBackground.color = e.target.value;
      if (editorBgColorText) editorBgColorText.value = e.target.value;
      applyBackgroundSettings();
      pushHistoryState();
    });
  }
  if (editorBgColorText) {
    editorBgColorText.value = state.editorBackground?.color || "#222228";
    editorBgColorText.addEventListener("input", (e) => {
      if (!state.editorBackground) state.editorBackground = {};
      state.editorBackground.color = e.target.value;
      if (editorBgColorInput && e.target.value.startsWith("#")) editorBgColorInput.value = e.target.value;
      applyBackgroundSettings();
      pushHistoryState();
    });
  }

  const editorBgBlurInput = document.getElementById("envTabEditorBgBlur");
  const editorBgBlurVal = document.getElementById("envTabEditorBgBlurVal");
  if (editorBgBlurInput) {
    editorBgBlurInput.value = state.editorBackground?.blur || 0;
    editorBgBlurInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (editorBgBlurVal) editorBgBlurVal.textContent = val.toFixed(2);
      if (!state.editorBackground) state.editorBackground = {};
      state.editorBackground.blur = val;
      applyBackgroundSettings();
      pushHistoryState();
    });
  }

  // Tone Mapping
  const toneSelect = document.getElementById("envTabToneMapping");
  if (toneSelect) {
    toneSelect.value = state.sceneSettings.environment?.toneMapping || "ACESFilmic";
    toneSelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.toneMapping = val;
      if (renderer) {
        if (val === "Linear") renderer.toneMapping = THREE.LinearToneMapping;
        else if (val === "Reinhard") renderer.toneMapping = THREE.ReinhardToneMapping;
        else if (val === "Cineon") renderer.toneMapping = THREE.CineonToneMapping;
        else if (val === "AgX") renderer.toneMapping = THREE.AgXToneMapping;
        else renderer.toneMapping = THREE.ACESFilmicToneMapping;
      }
      pushHistoryState();
    });
  }

  // Exposure
  const expInput = document.getElementById("envTabExposure");
  const expVal = document.getElementById("envTabExposureVal");
  if (expInput) {
    expInput.value = state.sceneSettings.environment?.exposure ?? 1.6;
    expInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (expVal) expVal.textContent = val.toFixed(1);
      if (!state.sceneSettings.environment) state.sceneSettings.environment = {};
      state.sceneSettings.environment.exposure = val;
      if (renderer) renderer.toneMappingExposure = val;
      pushHistoryState();
    });
  }

  // Shadows
  const shadowsCheck = document.getElementById("envTabShadows");
  if (shadowsCheck) {
    shadowsCheck.checked = state.sceneSettings.rendering?.shadows !== false;
    shadowsCheck.addEventListener("change", (e) => {
      setShadowsEnabled(e.target.checked);
    });
  }

  // Grid
  const gridCheck = document.getElementById("envTabGrid");
  if (gridCheck) {
    gridCheck.checked = state.sceneSettings.helpers?.grid !== false;
    gridCheck.addEventListener("change", (e) => {
      setGridVisible(e.target.checked);
    });
  }

  // Axes
  const axesCheck = document.getElementById("envTabAxes");
  if (axesCheck) {
    axesCheck.checked = Boolean(state.sceneSettings.helpers?.axes);
    axesCheck.addEventListener("change", (e) => {
      setAxesVisible(e.target.checked);
    });
  }

  // Bloom & Glow Event Handlers
  const bloomCheck = document.getElementById("envTabBloomEnabled");
  const bloomControls = document.getElementById("envTabBloomControls");
  const bloomStrength = document.getElementById("envTabBloomStrength");
  const bloomStrengthVal = document.getElementById("envTabBloomStrengthVal");
  const bloomRadius = document.getElementById("envTabBloomRadius");
  const bloomRadiusVal = document.getElementById("envTabBloomRadiusVal");
  const bloomThreshold = document.getElementById("envTabBloomThreshold");
  const bloomThresholdVal = document.getElementById("envTabBloomThresholdVal");

  if (bloomCheck) {
    bloomCheck.addEventListener("change", (e) => {
      const enabled = Boolean(e.target.checked);
      setBloomEnabled(enabled);
      if (bloomControls) bloomControls.style.display = enabled ? "block" : "none";
      // Synchronize Inspector if scene is selected
      const inspectorBloomCheck = document.getElementById("prop_scene_bloom_enable");
      if (inspectorBloomCheck) inspectorBloomCheck.checked = enabled;
      const inspectorBloomControls = document.getElementById("inspector_bloom_controls");
      if (inspectorBloomControls) inspectorBloomControls.style.display = enabled ? "" : "none";
      pushHistoryState();
    });
  }

  if (bloomStrength) {
    bloomStrength.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (bloomStrengthVal) bloomStrengthVal.textContent = val.toFixed(2);
      applyBloomSettings({ strength: val });
      const insp = document.getElementById("prop_scene_bloom_strength");
      if (insp) insp.value = val;
      const inspVal = document.getElementById("val_bloom_strength");
      if (inspVal) inspVal.textContent = val.toFixed(2);
      pushHistoryState();
    });
  }

  if (bloomRadius) {
    bloomRadius.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (bloomRadiusVal) bloomRadiusVal.textContent = val.toFixed(2);
      applyBloomSettings({ radius: val });
      const insp = document.getElementById("prop_scene_bloom_radius");
      if (insp) insp.value = val;
      const inspVal = document.getElementById("val_bloom_radius");
      if (inspVal) inspVal.textContent = val.toFixed(2);
      pushHistoryState();
    });
  }

  if (bloomThreshold) {
    bloomThreshold.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (bloomThresholdVal) bloomThresholdVal.textContent = val.toFixed(2);
      applyBloomSettings({ threshold: val });
      const insp = document.getElementById("prop_scene_bloom_threshold");
      if (insp) insp.value = val;
      const inspVal = document.getElementById("val_bloom_threshold");
      if (inspVal) inspVal.textContent = val.toFixed(2);
      pushHistoryState();
    });
  }
}

function parseColorString(str) {
  if (!str || typeof str !== "string") {
    return { hex: "#1e1e24", alpha: 0.92, r: 30, g: 30, b: 36 };
  }
  const s = str.trim();
  if (s.startsWith("#")) {
    let hex = s;
    let alpha = 1.0;
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    } else if (hex.length === 5) {
      const aHex = hex[4];
      alpha = parseInt(aHex + aHex, 16) / 255;
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    } else if (hex.length === 9) {
      alpha = parseInt(hex.slice(7, 9), 16) / 255;
      hex = hex.slice(0, 7);
    }
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return { hex, alpha: Math.min(Math.max(alpha, 0), 1), r, g, b };
  }
  const match = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (match) {
    const r = Math.min(255, Math.max(0, parseInt(match[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(match[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(match[3], 10)));
    const alpha = match[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(match[4]))) : 1.0;
    const toHex = (n) => n.toString(16).padStart(2, "0");
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return { hex, alpha, r, g, b };
  }
  return { hex: "#1e1e24", alpha: 0.92, r: 30, g: 30, b: 36 };
}

function formatRgbaString(hex, alpha) {
  const cleanHex = hex.startsWith("#") ? hex.slice(1) : hex;
  const fullHex = cleanHex.length === 3 
    ? `${cleanHex[0]}${cleanHex[0]}${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}` 
    : cleanHex;
  const r = parseInt(fullHex.slice(0, 2), 16) || 0;
  const g = parseInt(fullHex.slice(2, 4), 16) || 0;
  const b = parseInt(fullHex.slice(4, 6), 16) || 0;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function syncSettingsTabUI() {
  if (!state.sceneSettings) state.sceneSettings = {};
  if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
  if (!state.sceneSettings.line) state.sceneSettings.line = {};
  if (!state.sceneSettings.controls) {
    state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
  }

  // 1. Hotspots & Line
  const hotspots = state.sceneSettings.hotspots;
  const line = state.sceneSettings.line;

  const panelColor = hotspots.panelColor || "rgba(30, 30, 35, 0.92)";
  const panelColorInput = document.getElementById("settings_hotspot_panel_color");
  const panelColorText = document.getElementById("settings_hotspot_panel_color_text");
  const panelOpacitySlider = document.getElementById("settings_hotspot_panel_opacity");
  const valPanelOpacity = document.getElementById("val_settings_hotspot_panel_opacity");

  const parsedPanel = parseColorString(panelColor);
  if (panelColorInput) panelColorInput.value = parsedPanel.hex;
  if (panelColorText) panelColorText.value = panelColor;
  if (panelOpacitySlider) panelOpacitySlider.value = Math.round(parsedPanel.alpha * 100);
  if (valPanelOpacity) valPanelOpacity.textContent = `${Math.round(parsedPanel.alpha * 100)}%`;

  const titleFontColor = hotspots.titleFontColor || "#ffffff";
  const titleFontColorInput = document.getElementById("settings_hotspot_title_font_color");
  const titleFontColorText = document.getElementById("settings_hotspot_title_font_color_text");
  if (titleFontColorInput && titleFontColor.startsWith("#")) titleFontColorInput.value = titleFontColor;
  if (titleFontColorText) titleFontColorText.value = titleFontColor;

  const titleFontSize = hotspots.titleFontSize ?? 14;
  const titleFontSizeInput = document.getElementById("settings_hotspot_title_font_size");
  const valTitleFontSize = document.getElementById("val_settings_hotspot_title_font_size");
  if (titleFontSizeInput) titleFontSizeInput.value = titleFontSize;
  if (valTitleFontSize) valTitleFontSize.textContent = titleFontSize;

  const descFontColor = hotspots.descFontColor || "#e0e0e0";
  const descFontColorInput = document.getElementById("settings_hotspot_desc_font_color");
  const descFontColorText = document.getElementById("settings_hotspot_desc_font_color_text");
  if (descFontColorInput && descFontColor.startsWith("#")) descFontColorInput.value = descFontColor;
  if (descFontColorText) descFontColorText.value = descFontColor;

  const descFontSize = hotspots.descFontSize ?? 12.5;
  const descFontSizeInput = document.getElementById("settings_hotspot_desc_font_size");
  const valDescFontSize = document.getElementById("val_settings_hotspot_desc_font_size");
  if (descFontSizeInput) descFontSizeInput.value = descFontSize;
  if (valDescFontSize) valDescFontSize.textContent = descFontSize;

  const listFontColor = hotspots.listFontColor || "#cccccc";
  const listFontColorInput = document.getElementById("settings_hotspot_list_font_color");
  const listFontColorText = document.getElementById("settings_hotspot_list_font_color_text");
  if (listFontColorInput && listFontColor.startsWith("#")) listFontColorInput.value = listFontColor;
  if (listFontColorText) listFontColorText.value = listFontColor;

  const listFontSize = hotspots.listFontSize ?? 11;
  const listFontSizeInput = document.getElementById("settings_hotspot_list_font_size");
  const valListFontSize = document.getElementById("val_settings_hotspot_list_font_size");
  if (listFontSizeInput) listFontSizeInput.value = listFontSize;
  if (valListFontSize) valListFontSize.textContent = listFontSize;

  // Buttons
  const btnBgColor = hotspots.btnBgColor || "rgba(68, 214, 44, 0.28)";
  const btnBgColorInput = document.getElementById("settings_hotspot_btn_bg_color");
  const btnBgColorText = document.getElementById("settings_hotspot_btn_bg_color_text");
  const btnOpacitySlider = document.getElementById("settings_hotspot_btn_opacity");
  const valBtnOpacity = document.getElementById("val_settings_hotspot_btn_opacity");

  const parsedBtn = parseColorString(btnBgColor);
  if (btnBgColorInput) btnBgColorInput.value = parsedBtn.hex;
  if (btnBgColorText) btnBgColorText.value = btnBgColor;
  if (btnOpacitySlider) btnOpacitySlider.value = Math.round(parsedBtn.alpha * 100);
  if (valBtnOpacity) valBtnOpacity.textContent = `${Math.round(parsedBtn.alpha * 100)}%`;

  const btnFontColor = hotspots.btnFontColor || "#ffffff";
  const btnFontColorInput = document.getElementById("settings_hotspot_btn_font_color");
  const btnFontColorText = document.getElementById("settings_hotspot_btn_font_color_text");
  if (btnFontColorInput && btnFontColor.startsWith("#")) btnFontColorInput.value = btnFontColor;
  if (btnFontColorText) btnFontColorText.value = btnFontColor;

  const btnFontSize = hotspots.btnFontSize ?? 11;
  const btnFontSizeInput = document.getElementById("settings_hotspot_btn_font_size");
  const valBtnFontSize = document.getElementById("val_settings_hotspot_btn_font_size");
  if (btnFontSizeInput) btnFontSizeInput.value = btnFontSize;
  if (valBtnFontSize) valBtnFontSize.textContent = btnFontSize;

  const btnPaddingV = hotspots.btnPaddingV ?? 5;
  const btnPaddingH = hotspots.btnPaddingH ?? 12;
  const btnPaddingVInput = document.getElementById("settings_hotspot_btn_padding_v");
  const btnPaddingHInput = document.getElementById("settings_hotspot_btn_padding_h");
  const valBtnPadding = document.getElementById("val_settings_hotspot_btn_padding");
  if (btnPaddingVInput) btnPaddingVInput.value = btnPaddingV;
  if (btnPaddingHInput) btnPaddingHInput.value = btnPaddingH;
  if (valBtnPadding) valBtnPadding.textContent = `${btnPaddingV}px / ${btnPaddingH}px`;

  const btnMargin = hotspots.btnMargin ?? 5;
  const btnMarginInput = document.getElementById("settings_hotspot_btn_margin");
  const valBtnMargin = document.getElementById("val_settings_hotspot_btn_margin");
  if (btnMarginInput) btnMarginInput.value = btnMargin;
  if (valBtnMargin) valBtnMargin.textContent = btnMargin;

  // Connector Line
  const lineStyleSelect = document.getElementById("settings_line_style");
  if (lineStyleSelect) lineStyleSelect.value = line.style || "dashed";

  const lineColor = line.color || "#44D62C";
  const lineColorInput = document.getElementById("settings_line_color");
  const lineColorText = document.getElementById("settings_line_color_text");
  if (lineColorInput && lineColor.startsWith("#")) lineColorInput.value = lineColor;
  if (lineColorText) lineColorText.value = lineColor;

  const lineWidth = line.width ?? 1.5;
  const lineWidthInput = document.getElementById("settings_line_width");
  const valLineWidth = document.getElementById("val_settings_line_width");
  if (lineWidthInput) lineWidthInput.value = lineWidth;
  if (valLineWidth) valLineWidth.textContent = `${Number(lineWidth).toFixed(1)}px`;

  // 2. Viewer Buttons
  const controls = state.sceneSettings.controls;
  const btnExplode = document.getElementById("settings_btn_explode");
  if (btnExplode) btnExplode.checked = controls.explodeEnabled !== false;

  const btnSim = document.getElementById("settings_btn_simulator");
  const simBox = document.getElementById("settings_simulator_options_box");
  if (btnSim) {
    btnSim.checked = controls.simulatorEnabled !== false;
    if (simBox) simBox.style.display = btnSim.checked ? "" : "none";
  }

  const simUrl = document.getElementById("settings_sim_btn_url");
  if (simUrl) simUrl.value = controls.simulatorUrl || "";

  const simFn = document.getElementById("settings_sim_btn_fn");
  if (simFn) simFn.value = controls.simulatorJsFunction || "onSimulatorClick";

  // 3. Camera Navigation & Limits
  if (state.cameraRig) {
    const minPitch = Math.round(state.cameraRig.getMinPitchDeg ? state.cameraRig.getMinPitchDeg() : -82);
    const maxPitch = Math.round(state.cameraRig.getMaxPitchDeg ? state.cameraRig.getMaxPitchDeg() : 82);
    const minPitchSlider = document.getElementById("settings_cam_min_pitch");
    const minPitchNum = document.getElementById("settings_cam_min_pitch_num");
    const valMinPitch = document.getElementById("val_settings_cam_min_pitch");
    if (minPitchSlider) minPitchSlider.value = minPitch;
    if (minPitchNum) minPitchNum.value = minPitch;
    if (valMinPitch) valMinPitch.textContent = `${minPitch}°`;

    const maxPitchSlider = document.getElementById("settings_cam_max_pitch");
    const maxPitchNum = document.getElementById("settings_cam_max_pitch_num");
    const valMaxPitch = document.getElementById("val_settings_cam_max_pitch");
    if (maxPitchSlider) maxPitchSlider.value = maxPitch;
    if (maxPitchNum) maxPitchNum.value = maxPitch;
    if (valMaxPitch) valMaxPitch.textContent = `+${maxPitch}°`;

    const minDist = state.cameraRig.minDistance ?? 1.35;
    const maxDist = state.cameraRig.maxDistance ?? 16.0;
    const minDistSlider = document.getElementById("settings_cam_min_dist");
    const minDistNum = document.getElementById("settings_cam_min_dist_num");
    const valMinDist = document.getElementById("val_settings_cam_min_dist");
    if (minDistSlider) minDistSlider.value = minDist;
    if (minDistNum) minDistNum.value = minDist;
    if (valMinDist) valMinDist.textContent = `${Number(minDist).toFixed(2)}m`;

    const maxDistSlider = document.getElementById("settings_cam_max_dist");
    const maxDistNum = document.getElementById("settings_cam_max_dist_num");
    const valMaxDist = document.getElementById("val_settings_cam_max_dist");
    if (maxDistSlider) maxDistSlider.value = maxDist;
    if (maxDistNum) maxDistNum.value = maxDist;
    if (valMaxDist) valMaxDist.textContent = `${Number(maxDist).toFixed(1)}m`;

    const autoRotateCheck = document.getElementById("settings_cam_autorotate");
    if (autoRotateCheck) autoRotateCheck.checked = Boolean(state.cameraRig.autoRotate);
  }
}

function bindSettingsTab() {
  window.addEventListener("editorselectionchange", syncSettingsTabUI);

  // Panel background color & opacity
  const panelColorPicker = document.getElementById("settings_hotspot_panel_color");
  const panelColorText = document.getElementById("settings_hotspot_panel_color_text");
  const panelOpacitySlider = document.getElementById("settings_hotspot_panel_opacity");
  const valPanelOpacity = document.getElementById("val_settings_hotspot_panel_opacity");

  panelColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const currentAlpha = panelOpacitySlider ? Number(panelOpacitySlider.value) / 100 : 0.92;
    const rgba = formatRgbaString(e.target.value, currentAlpha);
    state.sceneSettings.hotspots.panelColor = rgba;
    if (panelColorText) panelColorText.value = rgba;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  panelColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.panelColor = e.target.value;
    const parsed = parseColorString(e.target.value);
    if (panelColorPicker) panelColorPicker.value = parsed.hex;
    if (panelOpacitySlider) panelOpacitySlider.value = Math.round(parsed.alpha * 100);
    if (valPanelOpacity) valPanelOpacity.textContent = `${Math.round(parsed.alpha * 100)}%`;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  panelOpacitySlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const alpha = Number(e.target.value) / 100;
    const currentHex = panelColorPicker?.value || "#1e1e24";
    const rgba = formatRgbaString(currentHex, alpha);
    state.sceneSettings.hotspots.panelColor = rgba;
    if (panelColorText) panelColorText.value = rgba;
    if (valPanelOpacity) valPanelOpacity.textContent = `${Math.round(alpha * 100)}%`;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  // Title font color & size
  const titleFontColorPicker = document.getElementById("settings_hotspot_title_font_color");
  const titleFontColorText = document.getElementById("settings_hotspot_title_font_color_text");
  const titleFontSizeSlider = document.getElementById("settings_hotspot_title_font_size");
  const valTitleFontSize = document.getElementById("val_settings_hotspot_title_font_size");

  titleFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.titleFontColor = e.target.value;
    if (titleFontColorText) titleFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  titleFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.titleFontColor = e.target.value;
    if (titleFontColorPicker && e.target.value.startsWith("#")) titleFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  titleFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.titleFontSize = Number(e.target.value);
    if (valTitleFontSize) valTitleFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  // Description font color & size
  const descFontColorPicker = document.getElementById("settings_hotspot_desc_font_color");
  const descFontColorText = document.getElementById("settings_hotspot_desc_font_color_text");
  const descFontSizeSlider = document.getElementById("settings_hotspot_desc_font_size");
  const valDescFontSize = document.getElementById("val_settings_hotspot_desc_font_size");

  descFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.descFontColor = e.target.value;
    if (descFontColorText) descFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  descFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.descFontColor = e.target.value;
    if (descFontColorPicker && e.target.value.startsWith("#")) descFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  descFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.descFontSize = Number(e.target.value);
    if (valDescFontSize) valDescFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  // List font color & size
  const listFontColorPicker = document.getElementById("settings_hotspot_list_font_color");
  const listFontColorText = document.getElementById("settings_hotspot_list_font_color_text");
  const listFontSizeSlider = document.getElementById("settings_hotspot_list_font_size");
  const valListFontSize = document.getElementById("val_settings_hotspot_list_font_size");

  listFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.listFontColor = e.target.value;
    if (listFontColorText) listFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  listFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.listFontColor = e.target.value;
    if (listFontColorPicker && e.target.value.startsWith("#")) listFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  listFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.listFontSize = Number(e.target.value);
    if (valListFontSize) valListFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  // Buttons: Background, Font Color, Font Size, Padding, Margin
  const btnBgColorPicker = document.getElementById("settings_hotspot_btn_bg_color");
  const btnBgColorText = document.getElementById("settings_hotspot_btn_bg_color_text");
  const btnOpacitySlider = document.getElementById("settings_hotspot_btn_opacity");
  const valBtnOpacity = document.getElementById("val_settings_hotspot_btn_opacity");
  const btnFontColorPicker = document.getElementById("settings_hotspot_btn_font_color");
  const btnFontColorText = document.getElementById("settings_hotspot_btn_font_color_text");
  const btnFontSizeSlider = document.getElementById("settings_hotspot_btn_font_size");
  const valBtnFontSize = document.getElementById("val_settings_hotspot_btn_font_size");
  const btnPaddingVInput = document.getElementById("settings_hotspot_btn_padding_v");
  const btnPaddingHInput = document.getElementById("settings_hotspot_btn_padding_h");
  const valBtnPadding = document.getElementById("val_settings_hotspot_btn_padding");
  const btnMarginSlider = document.getElementById("settings_hotspot_btn_margin");
  const valBtnMargin = document.getElementById("val_settings_hotspot_btn_margin");

  btnBgColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const currentAlpha = btnOpacitySlider ? Number(btnOpacitySlider.value) / 100 : 0.28;
    const rgba = formatRgbaString(e.target.value, currentAlpha);
    state.sceneSettings.hotspots.btnBgColor = rgba;
    if (btnBgColorText) btnBgColorText.value = rgba;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  btnBgColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnBgColor = e.target.value;
    const parsed = parseColorString(e.target.value);
    if (btnBgColorPicker) btnBgColorPicker.value = parsed.hex;
    if (btnOpacitySlider) btnOpacitySlider.value = Math.round(parsed.alpha * 100);
    if (valBtnOpacity) valBtnOpacity.textContent = `${Math.round(parsed.alpha * 100)}%`;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  btnOpacitySlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    const alpha = Number(e.target.value) / 100;
    const currentHex = btnBgColorPicker?.value || "#44D62C";
    const rgba = formatRgbaString(currentHex, alpha);
    state.sceneSettings.hotspots.btnBgColor = rgba;
    if (btnBgColorText) btnBgColorText.value = rgba;
    if (valBtnOpacity) valBtnOpacity.textContent = `${Math.round(alpha * 100)}%`;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  btnFontColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnFontColor = e.target.value;
    if (btnFontColorText) btnFontColorText.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  btnFontColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnFontColor = e.target.value;
    if (btnFontColorPicker && e.target.value.startsWith("#")) btnFontColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  btnFontSizeSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnFontSize = Number(e.target.value);
    if (valBtnFontSize) valBtnFontSize.textContent = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
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
    pushHistoryState();
  };
  btnPaddingVInput?.addEventListener("input", updatePadding);
  btnPaddingHInput?.addEventListener("input", updatePadding);

  btnMarginSlider?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.hotspots) state.sceneSettings.hotspots = {};
    state.sceneSettings.hotspots.btnMargin = Number(e.target.value);
    if (valBtnMargin) valBtnMargin.textContent = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  // Connector Line: Style, Color, Width
  const lineStyleSelect = document.getElementById("settings_line_style");
  const lineColorPicker = document.getElementById("settings_line_color");
  const lineColorText = document.getElementById("settings_line_color_text");
  const lineWidthSlider = document.getElementById("settings_line_width");
  const valLineWidth = document.getElementById("val_settings_line_width");

  lineStyleSelect?.addEventListener("change", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.style = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  lineColorPicker?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.color = e.target.value;
    if (lineColorText) lineColorText.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  lineColorText?.addEventListener("input", (e) => {
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.color = e.target.value;
    if (lineColorPicker && e.target.value.startsWith("#")) lineColorPicker.value = e.target.value;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });
  lineWidthSlider?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (!state.sceneSettings) state.sceneSettings = {};
    if (!state.sceneSettings.line) state.sceneSettings.line = {};
    state.sceneSettings.line.width = val;
    if (valLineWidth) valLineWidth.textContent = `${val.toFixed(1)}px`;
    applyGlobalHotspotSettings();
    pushHistoryState();
  });

  // Viewer Floating Buttons
  const btnExplodeCheck = document.getElementById("settings_btn_explode");
  const btnSimCheck = document.getElementById("settings_btn_simulator");
  const simBox = document.getElementById("settings_simulator_options_box");
  const simUrl = document.getElementById("settings_sim_btn_url");
  const simFn = document.getElementById("settings_sim_btn_fn");

  btnExplodeCheck?.addEventListener("change", (e) => {
    if (!state.sceneSettings.controls) {
      state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
    }
    state.sceneSettings.controls.explodeEnabled = Boolean(e.target.checked);
    pushHistoryState();
  });

  btnSimCheck?.addEventListener("change", (e) => {
    if (!state.sceneSettings.controls) {
      state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
    }
    const enabled = Boolean(e.target.checked);
    state.sceneSettings.controls.simulatorEnabled = enabled;
    if (simBox) simBox.style.display = enabled ? "" : "none";
    pushHistoryState();
  });

  simUrl?.addEventListener("input", (e) => {
    if (!state.sceneSettings.controls) {
      state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
    }
    state.sceneSettings.controls.simulatorUrl = e.target.value;
    pushHistoryState();
  });

  simFn?.addEventListener("input", (e) => {
    if (!state.sceneSettings.controls) {
      state.sceneSettings.controls = { defaultEnabled: true, explodeEnabled: true, simulatorEnabled: true };
    }
    state.sceneSettings.controls.simulatorJsFunction = e.target.value;
    pushHistoryState();
  });

  // Camera & Orbit Constraints
  document.getElementById("settingsSetDefaultCamBtn")?.addEventListener("click", () => {
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
      const btn = document.getElementById("settingsSetDefaultCamBtn");
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "&#10003; Default Saved!";
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
      }
    }
  });

  document.getElementById("settingsResetDefaultCamBtn")?.addEventListener("click", () => {
    if (state.cameraRig) {
      state.cameraRig.reset();
    }
  });

  document.getElementById("settingsFrameModelBtn")?.addEventListener("click", () => {
    if (state.cameraRig && state.currentModel) {
      state.cameraRig.focus(state.currentModel);
    }
  });

  const autoRotateCheck = document.getElementById("settings_cam_autorotate");
  autoRotateCheck?.addEventListener("change", (e) => {
    if (state.cameraRig) {
      state.cameraRig.autoRotate = Boolean(e.target.checked);
    }
  });

  // Pitch constraints
  const minPitchSlider = document.getElementById("settings_cam_min_pitch");
  const minPitchNum = document.getElementById("settings_cam_min_pitch_num");
  const valMinPitch = document.getElementById("val_settings_cam_min_pitch");
  const maxPitchSlider = document.getElementById("settings_cam_max_pitch");
  const maxPitchNum = document.getElementById("settings_cam_max_pitch_num");
  const valMaxPitch = document.getElementById("val_settings_cam_max_pitch");

  const updatePitchConstraints = (minDeg, maxDeg) => {
    if (state.cameraRig) {
      state.cameraRig.setMinPitchDeg(minDeg);
      state.cameraRig.setMaxPitchDeg(maxDeg);
    }
    if (minPitchSlider) minPitchSlider.value = minDeg;
    if (minPitchNum) minPitchNum.value = minDeg;
    if (valMinPitch) valMinPitch.textContent = `${minDeg}°`;
    if (maxPitchSlider) maxPitchSlider.value = maxDeg;
    if (maxPitchNum) maxPitchNum.value = maxDeg;
    if (valMaxPitch) valMaxPitch.textContent = `+${maxDeg}°`;
    pushHistoryState();
  };

  minPitchSlider?.addEventListener("input", (e) => {
    const minVal = parseInt(e.target.value, 10);
    const maxVal = parseInt(maxPitchSlider?.value || "82", 10);
    updatePitchConstraints(minVal, maxVal);
  });
  minPitchNum?.addEventListener("input", (e) => {
    const minVal = parseInt(e.target.value, 10);
    const maxVal = parseInt(maxPitchSlider?.value || "82", 10);
    updatePitchConstraints(minVal, maxVal);
  });

  maxPitchSlider?.addEventListener("input", (e) => {
    const minVal = parseInt(minPitchSlider?.value || "-82", 10);
    const maxVal = parseInt(e.target.value, 10);
    updatePitchConstraints(minVal, maxVal);
  });
  maxPitchNum?.addEventListener("input", (e) => {
    const minVal = parseInt(minPitchSlider?.value || "-82", 10);
    const maxVal = parseInt(e.target.value, 10);
    updatePitchConstraints(minVal, maxVal);
  });

  document.querySelectorAll(".settings-pitch-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const minP = parseInt(btn.dataset.min, 10);
      const maxP = parseInt(btn.dataset.max, 10);
      updatePitchConstraints(minP, maxP);
    });
  });

  // Distance limits
  const minDistSlider = document.getElementById("settings_cam_min_dist");
  const minDistNum = document.getElementById("settings_cam_min_dist_num");
  const valMinDist = document.getElementById("val_settings_cam_min_dist");
  const maxDistSlider = document.getElementById("settings_cam_max_dist");
  const maxDistNum = document.getElementById("settings_cam_max_dist_num");
  const valMaxDist = document.getElementById("val_settings_cam_max_dist");

  minDistSlider?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (state.cameraRig) state.cameraRig.minDistance = val;
    if (minDistNum) minDistNum.value = val;
    if (valMinDist) valMinDist.textContent = `${val.toFixed(2)}m`;
    pushHistoryState();
  });
  minDistNum?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (state.cameraRig) state.cameraRig.minDistance = val;
    if (minDistSlider) minDistSlider.value = val;
    if (valMinDist) valMinDist.textContent = `${val.toFixed(2)}m`;
    pushHistoryState();
  });

  maxDistSlider?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (state.cameraRig) state.cameraRig.maxDistance = val;
    if (maxDistNum) maxDistNum.value = val;
    if (valMaxDist) valMaxDist.textContent = `${val.toFixed(1)}m`;
    pushHistoryState();
  });
  maxDistNum?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (state.cameraRig) state.cameraRig.maxDistance = val;
    if (maxDistSlider) maxDistSlider.value = val;
    if (valMaxDist) valMaxDist.textContent = `${val.toFixed(1)}m`;
    pushHistoryState();
  });
}

function setAddMode(active) {
  state.addMode = active;
  state.currentMode = active ? "add-hotspot" : "idle";

  const addBtn = document.getElementById("addBtn");
  if (!addBtn) return;

  addBtn.textContent = active ? "Cancel" : "Add Hotspot";
  addBtn.classList.toggle("active", active);
}

function initializeEditor(loader) {
  state.viewport = state.viewport || document.getElementById("viewport");
  state.overlay = state.overlay || document.getElementById("overlay");
  state.hotspotLines = state.hotspotLines || document.getElementById("hotspotLines");

  state.hotspots = state.hotspots || [];
  state.lights = state.lights || [];
  clearSelection();
  state.addMode = false;
  state.currentMode = "idle";
  state.draggingHotspot = false;
  state.importedJsonFileName = state.importedJsonFileName || "hotspots.json";

  const scene = state.scene;
  const camera = state.camera;
  const renderer = state.renderer;
  const viewport = state.viewport;
  const raycaster = state.raycaster || new THREE.Raycaster();
  const mouse = state.mouse || new THREE.Vector2();

  state.raycaster = raycaster;
  state.mouse = mouse;

  // Background color listener
  const bgColorInput = document.getElementById("backgroundColor");
  if (bgColorInput) {
    bgColorInput.addEventListener("input", (e) => {
      state.sceneSettings.background = e.target.value;
      if (scene) scene.background = new THREE.Color(state.sceneSettings.background);
      pushHistoryState();
    });
  }

  const sidebar = state.sidebar || document.getElementById("sidebar");
  const toggleSidebarBtn = state.toggleSidebarBtn || document.getElementById("toggleSidebarBtn");

  if (sidebar) state.sidebar = sidebar;
  if (toggleSidebarBtn) state.toggleSidebarBtn = toggleSidebarBtn;

  // Core subsystems
  bindUI();
  bindIO(loader);
  bindLightUI();
  bindEnvironmentTab();
  bindSettingsTab();

  // Phase 2 Modules
  initializeGizmo();
  initializeHierarchy();
  initializeInspector();
  initHistory();

  // Camera Axis Snapping UI Listeners
  document.querySelectorAll(".camera-axis-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const axis = btn.getAttribute("data-axis");
      if (state.cameraRig && axis) {
        state.cameraRig.snapToAxis(axis);
      }
    });
  });

  // Studio Lighting Preset Buttons (Global delegation for sidebar and dynamic inspector)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".light-preset-btn");
    if (btn) {
      const preset = btn.getAttribute("data-preset");
      if (preset) {
        applyLightingPreset(preset);
      }
    }
  });

  const frameHandler = () => {
    if (state.cameraRig && state.currentModel) {
      state.cameraRig.focus(state.currentModel);
    }
  };

  const resetViewHandler = () => {
    if (state.cameraRig) {
      state.cameraRig.reset();
    }
  };

  document.getElementById("resetCamViewBtn")?.addEventListener("click", resetViewHandler);
  document.getElementById("sidebarFrameModelBtn")?.addEventListener("click", frameHandler);

  document.getElementById("sidebarSetDefaultCamBtn")?.addEventListener("click", () => {
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
      const btn = document.getElementById("sidebarSetDefaultCamBtn");
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "&#10003; Default Saved!";
        setTimeout(() => { btn.innerHTML = originalText; }, 1500);
      }
    }
  });

  document.getElementById("sidebarResetDefaultCamBtn")?.addEventListener("click", () => {
    if (state.cameraRig) {
      state.cameraRig.reset();
    }
  });

  // Hotspot add button
  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.onclick = () => {
      setAddMode(!state.addMode);
    };
  }

  // Track pointer down coordinates to distinguish between camera orbit drags and single clicks
  let pointerDownPos = { x: 0, y: 0 };

  renderer.domElement.addEventListener("pointerdown", (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  // Universal Click Selection & Hotspot Creation
  renderer.domElement.addEventListener("click", (e) => {
    // If dragging a hotspot or transforming with gizmo, ignore click
    if (state.draggingHotspot || state.transformControls?.dragging) return;

    // Distinguish between camera orbit/rotate drag and a single click
    const dragDistance = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dragDistance > 5) {
      // User was rotating the object or panning the camera; preserve current selection
      return;
    }

    mouse.x = (e.offsetX / viewport.clientWidth) * 2 - 1;
    mouse.y = -(e.offsetY / viewport.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 1. Check Light Sprites
    const lightSprites = state.lights.filter(l => !l.locked).map((l) => l.lightSprite).filter(Boolean);
    const lightHits = raycaster.intersectObjects(lightSprites);

    if (lightHits.length) {
      const lightData = state.lights.find((l) => l.lightSprite === lightHits[0].object);
      if (lightData) {
        select("light", lightData);
        showSidebarTab("properties");
        return;
      }
    }

    // 2. Check Light Target Sprites
    const targetSprites = state.lights.filter(l => !l.locked).map((l) => l.targetSprite).filter(Boolean);
    const targetHits = raycaster.intersectObjects(targetSprites);

    if (targetHits.length) {
      const lightData = state.lights.find((l) => l.targetSprite === targetHits[0].object);
      if (lightData) {
        select("lightTarget", lightData, lightData.target);
        showSidebarTab("properties");
        return;
      }
    }

    // 3. Check Current Model
    const intersects = state.currentModel
      ? raycaster.intersectObject(state.currentModel, true).filter(hit => !hit.object.userData?.locked)
      : [];

    if (state.addMode) {
      if (intersects.length) {
        const point = intersects[0].point;
        createHotspot(point);
        setAddMode(false);
        renderHierarchy();
        pushHistoryState();
        return;
      }

      setAddMode(false);
      return;
    }

    // 4. If single click was directly on the 3D model, keep the currently selected object active
    if (intersects.length > 0) {
      return;
    }

    // 5. Only deselect when single clicking outside of the 3D model (empty space)
    if (lightHits.length === 0 && targetHits.length === 0) {
      deselect();
    }
  });

  // Global delete key handler
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (state.selection?.type === "hotspot" && state.selection.object) {
        removeHotspot(state.selection.object);
        deselect("hotspot");
        renderHierarchy();
        pushHistoryState();
      } else if (state.selection?.type === "light" && state.selection.object) {
        deleteSelectedLight();
        deselect("light");
        renderHierarchy();
        pushHistoryState();
      }
    }

    // Undo / Redo shortcuts
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      redo();
      return;
    }

    // Camera view shortcuts
    if (state.cameraRig) {
      if (e.code === "Numpad1" || e.code === "Digit1") {
        e.preventDefault();
        state.cameraRig.snapToAxis(e.ctrlKey || e.altKey || e.shiftKey ? "back" : "front");
      } else if (e.code === "Numpad3" || e.code === "Digit3") {
        e.preventDefault();
        state.cameraRig.snapToAxis(e.ctrlKey || e.altKey || e.shiftKey ? "left" : "right");
      } else if (e.code === "Numpad7" || e.code === "Digit7") {
        e.preventDefault();
        state.cameraRig.snapToAxis(e.ctrlKey || e.altKey || e.shiftKey ? "bottom" : "top");
      } else if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey) {
        if (state.currentModel) {
          state.cameraRig.focus(state.currentModel);
        }
      }
    }
  });

  function animateFrame() {
    updateHotspots();
    updateLights();
  }

  startAnimation(animateFrame);

  // Responsive resizing via window and container ResizeObserver
  window.addEventListener("resize", () => {
    resizeRenderer();
  });

  if (window.ResizeObserver && state.viewport) {
    const resizeObserver = new ResizeObserver(() => {
      resizeRenderer();
    });
    resizeObserver.observe(state.viewport);
  }
}

export { initializeEditor, syncEnvironmentTabUI, syncSettingsTabUI };
