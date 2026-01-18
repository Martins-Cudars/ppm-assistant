import { createApp } from "vue";
import { createPinia } from "pinia";
import PlayerReport from "./sports/hockey/views/components/PlayerReport.vue";

// Mount the Player Report component
const app = createApp(PlayerReport);
const pinia = createPinia();
app.use(pinia);
app.mount("#app");
