import { createApp } from "vue";
import { createPinia } from "pinia";
import FullPlayerTable from "./sports/hockey/views/components/FullPlayerTable.vue";

// Mount the Full Player Table component
const app = createApp(FullPlayerTable);
const pinia = createPinia();
app.use(pinia);
app.mount("#app");
