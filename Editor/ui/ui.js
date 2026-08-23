import { state } from "../state/state.js";
import { resizeRenderer } from "../render/render.js";

let sidebarToggleBound = false;
let sidebarTabsBound = false;
let fileMenuBound = false;

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
        if (fileMenuContainer && !fileMenuContainer.contains(e.target)) {
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
}

export {
  bindUI,
  showSidebarTab
};

