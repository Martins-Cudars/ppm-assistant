<template>
  <div class="player-profile player-profile--export">
    <button type="button" @click="copyJson">Copy JSON</button>
    <button type="button" @click="copyCsv">Copy CSV</button>
    <div v-if="statusMessage" class="export__status" aria-live="polite">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue";

const props = defineProps<{
  toJson: () => string;
  toCsv: () => string;
}>();

const statusMessage = ref("");
let statusTimeout: number | undefined;

function setStatus(message: string): void {
  statusMessage.value = message;

  if (statusTimeout !== undefined) {
    window.clearTimeout(statusTimeout);
  }

  statusTimeout = window.setTimeout(() => {
    statusMessage.value = "";
    statusTimeout = undefined;
  }, 2000);
}

function copyWithFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (!copyWithFallback(text)) {
      throw new Error("Clipboard copy failed");
    }

    setStatus(`${label} copied`);
  } catch {
    setStatus(`Could not copy ${label}`);
  }
}

function copyJson(): void {
  void copyToClipboard(props.toJson(), "JSON");
}

function copyCsv(): void {
  void copyToClipboard(props.toCsv(), "CSV");
}

onUnmounted(() => {
  if (statusTimeout !== undefined) {
    window.clearTimeout(statusTimeout);
  }
});
</script>

<style scoped>
.player-profile--export {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.export__status {
  grid-column: 1 / span 2;
  color: #225c39;
  font-size: 12px;
  min-height: 16px;
  text-align: center;
}
</style>
