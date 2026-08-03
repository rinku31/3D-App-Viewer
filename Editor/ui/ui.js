import { state } from "../state/state.js";

function bindUI(){
  const sidebar = state.sidebar || document.getElementById("sidebar");
  const toggleSidebarBtn = state.toggleSidebarBtn || document.getElementById("toggleSidebarBtn");

  if (sidebar) {
    state.sidebar = sidebar;
  }

  if (toggleSidebarBtn) {
    state.toggleSidebarBtn = toggleSidebarBtn;
  }

  if (sidebar && toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
      toggleSidebarBtn.classList.toggle("sidebar-hidden");
    });
  }
}

export {
  bindUI
};
