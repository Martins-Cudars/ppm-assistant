import { createApp } from "vue";
import { createPinia } from "pinia";
import ReportShell from "./components/ReportShell.vue";

// Mount the Player Report page: one tab per sport.
const app = createApp(ReportShell);
const pinia = createPinia();
app.use(pinia);
app.mount("#app");
