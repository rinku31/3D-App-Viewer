import * as THREE from "three";
import { state } from "../state/state.js";
import { select, isSelected } from "../selection/selection.js";
import { removeHotspot } from "../hotspots/hotspots.js";
import { deleteSelectedLight, setLightVisibility } from "../lights/lights.js";
import { frameModel } from "../render/render.js";
import { showSidebarTab } from "../ui/ui.js";

let hierarchyContainer = null;
let searchQuery = "";
let expandedNodes = new Set(["scene", "model", "lights", "hotspots"]);

function initializeHierarchy() {
  hierarchyContainer = document.getElementById("sceneHierarchyTree");
  if (!hierarchyContainer) return;

  const searchInput = document.getElementById("hierarchySearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderHierarchy();
    });
  }

  window.addEventListener("editorselectionchange", renderHierarchy);
  renderHierarchy();
}

function renderHierarchy() {
  if (!hierarchyContainer) {
    hierarchyContainer = document.getElementById("sceneHierarchyTree");
    if (!hierarchyContainer) return;
  }

  let html = `<div class="tree-root">`;

  // 1. Scene Root Item
  html += buildTreeItem({
    id: "scene_root",
    label: "Scene Root",
    icon: "&#127760;",
    type: "scene",
    object: state.scene,
    hasChildren: true,
    expanded: expandedNodes.has("scene"),
    categoryKey: "scene"
  });

  if (expandedNodes.has("scene")) {
    html += `<div class="tree-children">`;

    // 2. Camera Item
    if (state.camera) {
      html += buildTreeItem({
        id: "camera_node",
        label: `Perspective Camera (FOV: ${Math.round(state.camera.fov)}°)`,
        icon: "&#127916;",
        type: "camera",
        object: state.camera,
        hasChildren: false
      });
    }

    // 3. Model Node (Selectable in Inspector for rotation & transforms)
    if (state.currentModel) {
      const modelLabel = state.currentModel.name || "GLB Model";
      html += buildTreeItem({
        id: "model_root",
        label: `${escapeHTML(modelLabel)} <span class="tree-meta">3D Model</span>`,
        icon: "&#128230;",
        type: "model",
        object: state.currentModel,
        hasChildren: false,
        actions: `
          <button class="tree-action-btn" data-action="frame-model" title="Frame Model in Viewport">&#128269;</button>
        `
      });
    } else {
      html += `
        <div class="tree-empty-notice">
          <span>&#128230; No model imported</span>
          <button id="hierarchyImportBtn" class="tree-inline-btn">Import GLB</button>
        </div>
      `;
    }

    // 4. Lights Group
    const lightCount = (state.lights ? state.lights.length : 0) + 2; // + ambient & default dir light
    html += buildTreeItem({
      id: "lights_group",
      label: `Lights (${lightCount})`,
      icon: "&#128161;",
      type: "lights_group",
      object: null,
      hasChildren: true,
      expanded: expandedNodes.has("lights"),
      categoryKey: "lights",
      actions: `
        <button class="tree-action-btn" data-action="add-light" title="Add Directional Light">&#10133;</button>
      `
    });

    if (expandedNodes.has("lights")) {
      html += `<div class="tree-children">`;
      // Default ambient
      html += buildTreeItem({
        id: "ambient_light",
        label: "Default Ambient Light",
        icon: "&#9728;",
        type: "scene",
        object: state.scene,
        hasChildren: false
      });

      // Custom authored lights
      if (Array.isArray(state.lights)) {
        state.lights.forEach((l, idx) => {
          const colorSwatch = `<span class="color-swatch-sm" style="background:${l.color}"></span>`;
          const rawType = (l.type || "directional").toLowerCase();
          let icon = "&#9889;"; // Directional
          if (rawType.includes("point")) icon = "&#128161;";
          else if (rawType.includes("spot")) icon = "&#128294;";
          else if (rawType.includes("area") || rawType.includes("rect")) icon = "&#128396;"; // Softbox
          else if (rawType.includes("ambient")) icon = "&#9728;";

          const hasTarget = Boolean(l.target);
          const isExpanded = expandedNodes.has(`light_${l.id}`);

          html += buildTreeItem({
            id: `light_${l.id}`,
            label: `${colorSwatch} ${l.name || l.id || "Light " + (idx + 1)}`,
            icon: icon,
            type: "light",
            object: l,
            hasChildren: hasTarget,
            expanded: isExpanded,
            categoryKey: `light_${l.id}`,
            actions: `
              <button class="tree-action-btn lock ${l.locked ? 'locked' : ''}" data-action="toggle-lock" data-id="${l.id}" data-type="light" title="Toggle Selectability">
                ${l.locked ? '&#128274;' : '&#128275;'}
              </button>
              <button class="tree-action-btn visibility ${l.visible !== false ? '' : 'hidden-obj'}" data-action="toggle-visibility" data-id="${l.id}" data-type="light" title="Toggle Visibility">
                ${l.visible !== false ? '&#128065;' : '&#128584;'}
              </button>
              <button class="tree-action-btn delete" data-action="delete-light" data-id="${l.id}" title="Delete Light">&#128465;</button>
            `
          });

          if (hasTarget && isExpanded) {
            html += `<div class="tree-children">`;
            html += buildTreeItem({
              id: `light_target_${l.id}`,
              label: `Target (${l.target.position.x.toFixed(1)}, ${l.target.position.y.toFixed(1)}, ${l.target.position.z.toFixed(1)})`,
              icon: "&#127919;",
              type: "lightTarget",
              object: l,
              target: l.target,
              hasChildren: false
            });
            html += `</div>`;
          }
        });
      }
      html += `</div>`;
    }

    // 5. Hotspots Group
    const hotspotCount = state.hotspots ? state.hotspots.length : 0;
    html += buildTreeItem({
      id: "hotspots_group",
      label: `Hotspots (${hotspotCount})`,
      icon: "&#128205;",
      type: "hotspots_group",
      object: null,
      hasChildren: true,
      expanded: expandedNodes.has("hotspots"),
      categoryKey: "hotspots",
      actions: `
        <button class="tree-action-btn" data-action="add-hotspot" title="Add Hotspot">&#10133;</button>
      `
    });

    if (expandedNodes.has("hotspots")) {
      html += `<div class="tree-children">`;
      if (Array.isArray(state.hotspots) && state.hotspots.length > 0) {
        state.hotspots.forEach((h, idx) => {
          html += buildTreeItem({
            id: `hotspot_${h.id}`,
            label: `${idx + 1}. ${escapeHTML(h.title || "Untitled Hotspot")}`,
            icon: "&#128308;",
            type: "hotspot",
            object: h,
            hasChildren: false,
            actions: `
              <button class="tree-action-btn lock ${h.locked ? 'locked' : ''}" data-action="toggle-lock" data-id="${h.id}" data-type="hotspot" title="Toggle Selectability">
                ${h.locked ? '&#128274;' : '&#128275;'}
              </button>
              <button class="tree-action-btn visibility ${h.visible !== false ? '' : 'hidden-obj'}" data-action="toggle-visibility" data-id="${h.id}" data-type="hotspot" title="Toggle Visibility">
                ${h.visible !== false ? '&#128065;' : '&#128584;'}
              </button>
              <button class="tree-action-btn" data-action="focus-hotspot" data-id="${h.id}" title="Focus Camera">&#128269;</button>
              <button class="tree-action-btn delete" data-action="delete-hotspot" data-id="${h.id}" title="Delete Hotspot">&#128465;</button>
            `
          });
        });
      } else {
        html += `<div class="tree-empty-notice"><span>No hotspots created</span></div>`;
      }
      html += `</div>`;
    }

    html += `</div>`; // Close Scene Root Children
  }

  html += `</div>`; // Close tree-root

  hierarchyContainer.innerHTML = html;
  bindHierarchyEvents();
}

function buildModelChildren(node, depth = 0) {
  if (!node || depth > 5) return "";
  let html = "";

  node.children?.forEach((child) => {
    // Filter out internal helpers like gizmo anchor
    if (child.name === "__gizmo_anchor__" || child.isTransformControls) return;

    const isMesh = child.isMesh;
    const name = child.name || (isMesh ? "Mesh" : "Group");
    const vertCount = isMesh && child.geometry?.attributes?.position ? child.geometry.attributes.position.count : 0;
    const vertLabel = vertCount > 0 ? `<span class="tree-meta">${vertCount}v</span>` : "";

    // Apply search filter if active
    if (searchQuery && !name.toLowerCase().includes(searchQuery)) {
      // Check if any descendant matches
      let hasMatch = false;
      child.traverse((desc) => {
        if (desc.name && desc.name.toLowerCase().includes(searchQuery)) hasMatch = true;
      });
      if (!hasMatch) return;
    }

    const hasChildren = child.children && child.children.length > 0;
    const nodeKey = `mesh_node_${child.id}`;
    const isExpanded = expandedNodes.has(nodeKey);

    html += buildTreeItem({
      id: nodeKey,
      label: `${escapeHTML(name)} ${vertLabel}`,
      icon: isMesh ? "&#11042;" : "&#128193;",
      type: "mesh",
      object: child,
      hasChildren: hasChildren,
      expanded: isExpanded,
      categoryKey: nodeKey,
      actions: ``
    });

    if (hasChildren && isExpanded) {
      html += `<div class="tree-children">`;
      html += buildModelChildren(child, depth + 1);
      html += `</div>`;
    }
  });

  return html;
}

function buildTreeItem({ id, label, icon, type, object, target = null, hasChildren = false, expanded = false, categoryKey = null, actions = "" }) {
  const selected = type && object ? isSelected(type, object) : false;
  const isTargetSelected = type === "lightTarget" && state.selection?.type === "lightTarget" && state.selection?.object === object;

  const activeClass = (selected || isTargetSelected) ? "selected" : "";

  return `
    <div class="tree-item-row ${activeClass}" data-item-id="${id}" data-type="${type || ''}">
      <div class="tree-item-left" data-select-type="${type || ''}">
        ${hasChildren ? `
          <button class="tree-toggle-btn ${expanded ? 'expanded' : ''}" data-toggle-key="${categoryKey || id}">
            &#9656;
          </button>
        ` : `<span class="tree-spacer"></span>`}
        <span class="tree-icon">${icon}</span>
        <span class="tree-label" title="${stripHTML(label)}">${label}</span>
      </div>
      <div class="tree-item-actions">
        ${actions}
      </div>
    </div>
  `;
}

function bindHierarchyEvents() {
  if (!hierarchyContainer) return;

  // Toggle expand/collapse
  hierarchyContainer.querySelectorAll(".tree-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = btn.dataset.toggleKey;
      if (expandedNodes.has(key)) {
        expandedNodes.delete(key);
      } else {
        expandedNodes.add(key);
      }
      renderHierarchy();
    });
  });

  // Select on row click
  hierarchyContainer.querySelectorAll(".tree-item-row").forEach((row) => {
    const type = row.dataset.type;
    const itemId = row.dataset.itemId;

    row.querySelector(".tree-item-left")?.addEventListener("click", (e) => {
      e.stopPropagation();
      handleTreeSelection(type, itemId);
    });
  });

  // Action buttons
  hierarchyContainer.querySelectorAll(".tree-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;

      if (action === "add-hotspot") {
        document.getElementById("addBtn")?.click();
      } else if (action === "add-light") {
        document.getElementById("addDirectionalLightBtn")?.click();
      } else if (action === "frame-model") {
        if (state.currentModel) frameModel(state.currentModel);
      } else if (action === "delete-hotspot") {
        const id = btn.dataset.id;
        const hotspot = state.hotspots?.find((h) => h.id === id);
        if (hotspot) {
          removeHotspot(hotspot);
          renderHierarchy();
        }
      } else if (action === "delete-light") {
        deleteSelectedLight();
        renderHierarchy();
      } else if (action === "toggle-visibility") {
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        if (type === "hotspot") {
          const hotspot = state.hotspots?.find((h) => h.id === id);
          if (hotspot) {
            hotspot.visible = (hotspot.visible === false) ? true : false;
            // Hotspot visibility update is handled cleanly by updateHotspots loop on next frame based on h.visible, 
            // but we can manually force dot/panel hide here if desired.
            if (!hotspot.visible) {
               if (hotspot.dot) hotspot.dot.style.display = "none";
               if (hotspot.panel) hotspot.panel.style.display = "none";
               if (hotspot.line) hotspot.line.style.display = "none";
            }
            renderHierarchy();
          }
        } else if (type === "light") {
          const lightData = state.lights?.find((l) => l.id === id);
          if (lightData) {
            setLightVisibility(lightData, lightData.visible === false ? true : false);
            renderHierarchy();
          }
        }
      } else if (action === "toggle-lock") {
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        if (type === "hotspot") {
          const hotspot = state.hotspots?.find((h) => h.id === id);
          if (hotspot) {
            hotspot.locked = !hotspot.locked;
            renderHierarchy();
          }
        } else if (type === "light") {
          const lightData = state.lights?.find((l) => l.id === id);
          if (lightData) {
            lightData.locked = !lightData.locked;
            renderHierarchy();
          }
        }
      } else if (action === "focus-hotspot") {
        const id = btn.dataset.id;
        const hotspot = state.hotspots?.find((h) => h.id === id);
        if (hotspot && state.cameraRig) {
          const target = new THREE.Vector3(hotspot.position[0], hotspot.position[1], hotspot.position[2]);
          state.cameraRig.focus(target);
          select("hotspot", hotspot);
          showSidebarTab("scene");
        }
      }
    });
  });

  document.getElementById("hierarchyImportBtn")?.addEventListener("click", () => {
    document.getElementById("modelInput")?.click();
  });
}

function handleTreeSelection(type, itemId) {
  if (!type) return;

  if (type === "scene") {
    select("scene", state.scene);
    showSidebarTab("scene");
  } else if (type === "model") {
    select("model", state.currentModel);
    showSidebarTab("scene");
  } else if (type === "camera") {
    select("camera", state.camera);
    showSidebarTab("scene");
  } else if (type === "light") {
    const lightId = itemId.replace("light_", "");
    const lightData = state.lights?.find((l) => l.id === lightId);
    if (lightData) {
      select("light", lightData);
      showSidebarTab("scene");
    }
  } else if (type === "lightTarget") {
    const lightId = itemId.replace("light_target_", "");
    const lightData = state.lights?.find((l) => l.id === lightId);
    if (lightData) {
      select("lightTarget", lightData, lightData.target);
      showSidebarTab("scene");
    }
  } else if (type === "hotspot") {
    const hotspotId = itemId.replace("hotspot_", "");
    const hotspot = state.hotspots?.find((h) => h.id === hotspotId);
    if (hotspot) {
      select("hotspot", hotspot);
      showSidebarTab("scene");
    }
  }
}

function stripHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
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
  initializeHierarchy,
  renderHierarchy
};
