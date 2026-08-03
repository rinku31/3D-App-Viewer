import { state } from "../state/state.js";

let sidebarToggleBound = false;
let sidebarTabsBound = false;

function showSidebarTab(tabName){
  document.querySelectorAll(".sidebar-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".sidebar-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}Tab`);
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
}

export {
  bindUI,
  showSidebarTab
};
