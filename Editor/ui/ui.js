import { state } from "../state/state.js";
import { resizeRenderer } from "../render/render.js";

let sidebarToggleBound = false;
let sidebarTabsBound = false;
let fileMenuBound = false;
let resizersBound = false;

function bindResizers() {
  if (resizersBound) return;

  const horizontalResizer = document.getElementById("sidebarResizer");
  const verticalResizer = document.getElementById("sceneTabResizer");
  const sidebar = document.getElementById("sidebar");
  const hierarchyWindow = document.getElementById("hierarchyWindow");

  if (horizontalResizer && sidebar) {
    let isResizing = false;
    horizontalResizer.addEventListener("pointerdown", (e) => {
      isResizing = true;
      horizontalResizer.setPointerCapture(e.pointerId);
      horizontalResizer.classList.add("dragging");
      document.body.classList.add("navigating-viewport"); // Prevent selection
    });
    
    window.addEventListener("pointermove", (e) => {
      if (!isResizing) return;
      // Sidebar is on the right, so width is window.innerWidth - e.clientX
      const newWidth = Math.max(280, Math.min(800, window.innerWidth - e.clientX));
      sidebar.style.flex = `0 0 ${newWidth}px`;
      sidebar.style.width = `${newWidth}px`;
      resizeRenderer();
    });

    window.addEventListener("pointerup", (e) => {
      if (isResizing) {
        isResizing = false;
        try { horizontalResizer.releasePointerCapture(e.pointerId); } catch(err) {}
        horizontalResizer.classList.remove("dragging");
        document.body.classList.remove("navigating-viewport");
        resizeRenderer();
      }
    });
  }

  if (verticalResizer && hierarchyWindow) {
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    verticalResizer.addEventListener("pointerdown", (e) => {
      isResizing = true;
      verticalResizer.setPointerCapture(e.pointerId);
      startY = e.clientY;
      startHeight = hierarchyWindow.offsetHeight;
      verticalResizer.classList.add("dragging");
      document.body.classList.add("navigating-viewport");
    });
    
    window.addEventListener("pointermove", (e) => {
      if (!isResizing) return;
      const dy = e.clientY - startY;
      const newHeight = Math.max(100, startHeight + dy);
      hierarchyWindow.style.flex = `0 0 ${newHeight}px`;
    });

    window.addEventListener("pointerup", (e) => {
      if (isResizing) {
        isResizing = false;
        try { verticalResizer.releasePointerCapture(e.pointerId); } catch(err) {}
        verticalResizer.classList.remove("dragging");
        document.body.classList.remove("navigating-viewport");
      }
    });
  }

  resizersBound = true;
}

function showSidebarTab(tabName){
  // If tabName is "properties", it now maps to "scene"
  const normalizedTab = tabName === "properties" ? "scene" : tabName;

  document.querySelectorAll(".sidebar-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === normalizedTab);
  });

  document.querySelectorAll(".sidebar-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${normalizedTab}Tab`);
  });
}

function bindUI(){
  const sidebar = state.sidebar || document.getElementById("sidebar");
  const toggleSidebarBtn = state.toggleSidebarBtn || document.getElementById("toggleSidebarBtn");

  if (sidebar) {
    state.sidebar = sidebar;
  }

  if (toggleSidebarBtn) {
    state.toggleSidebarBtn = toggleSidebarBtn;
  }

  if (sidebar && toggleSidebarBtn && !sidebarToggleBound) {
    toggleSidebarBtn.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
      toggleSidebarBtn.classList.toggle("sidebar-hidden");
      resizeRenderer();
    });
    sidebarToggleBound = true;
  }

  if (!sidebarTabsBound) {
    document.querySelectorAll(".sidebar-tab").forEach((button) => {
      button.addEventListener("click", () => {
        showSidebarTab(button.dataset.tab);
      });
    });
    sidebarTabsBound = true;
  }

  // Topbar File Menu Dropdown toggle
  if (!fileMenuBound) {
    const fileMenuBtn = document.getElementById("fileMenuBtn");
    const fileDropdown = document.getElementById("fileDropdown");
    const fileMenuContainer = document.getElementById("fileMenuContainer");

    if (fileMenuBtn && fileDropdown) {
      fileMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = fileDropdown.classList.contains("show");
        fileDropdown.classList.toggle("show", !isOpen);
        fileMenuBtn.classList.toggle("active", !isOpen);
      });

      // Close dropdown on click inside any item
      fileDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
        item.addEventListener("click", () => {
          fileDropdown.classList.remove("show");
          fileMenuBtn.classList.remove("active");
        });
      });

      // Close when clicking outside
      document.addEventListener("click", (e) => {
        if (!fileDropdown.contains(e.target) && !fileMenuBtn.contains(e.target)) {
          fileDropdown.classList.remove("show");
          fileMenuBtn.classList.remove("active");
        }
      });

      // Close on escape key
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          fileDropdown.classList.remove("show");
          fileMenuBtn.classList.remove("active");
        }
      });
    }
    fileMenuBound = true;
  }
  
  bindResizers();
}

export {
  bindUI,
  showSidebarTab
};


export function showLoading(text = "Loading 3D Model...") {
  const overlay = document.getElementById("embedLoadingOverlay");
  const textElem = overlay?.querySelector(".embed-loading-text");
  if (textElem) textElem.textContent = text;
  if (overlay) {
    overlay.classList.remove("hidden");
  }
}

export function hideLoading() {
  const overlay = document.getElementById("embedLoadingOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}
