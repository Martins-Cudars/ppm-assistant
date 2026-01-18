import { createApp } from "vue";
import { createPinia } from "pinia";
import FullPlayerTable from "./components/FullPlayerTable.vue";

const viewFullPlayerTable = () => {
  // Find the main content area to inject our component
  const contentArea = document.querySelector(".content_middle") || document.querySelector(".content");

  if (!contentArea) {
    console.error("Content area not found");
    return;
  }

  // Create mount point for our Vue app
  const appContainer = document.createElement("div");
  appContainer.id = "ppm-assistant-full-player-table";

  // Clear existing content and add our container
  contentArea.innerHTML = "";
  contentArea.appendChild(appContainer);

  // Mount Vue app
  const app = createApp(FullPlayerTable);
  const pinia = createPinia();
  app.use(pinia);
  app.mount(appContainer);
};

export default viewFullPlayerTable;
