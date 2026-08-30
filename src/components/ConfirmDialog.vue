<template>
  <div
    v-if="open"
    class="dialog-backdrop"
    @click.self="$emit('cancel')"
  >
    <div
      ref="dialogEl"
      class="dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <h3 :id="titleId" class="dialog-title" :class="{ danger }">{{ title }}</h3>

      <div class="dialog-body">
        <slot />
      </div>

      <div class="dialog-actions">
        <!--
          Cancel comes first in DOM order and takes focus on open, so the
          destructive action is never one stray Enter away.
        -->
        <button ref="cancelEl" class="dialog-cancel" @click="$emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button
          class="dialog-confirm"
          :class="{ danger }"
          :disabled="confirmDisabled"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, useId } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Styles the confirm button as destructive. */
    danger?: boolean;
    /**
     * Blocks the confirm action - for when something the dialog's own body
     * started (a backup download, say) has to finish before it's safe to go
     * ahead. Cancel stays live: the user must always be able to back out.
     */
    confirmDisabled?: boolean;
  }>(),
  {
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
    confirmDisabled: false,
  }
);

const emit = defineEmits<{ (event: "confirm"): void; (event: "cancel"): void }>();

const titleId = useId();
const dialogEl = ref<HTMLElement | null>(null);
const cancelEl = ref<HTMLButtonElement | null>(null);

// Landing focus on Cancel keeps the destructive button off the default.
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    cancelEl.value?.focus();
  }
);

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Every focusable element inside the dialog, in DOM order.
 *
 * Queried live rather than held as two refs: callers put focusable content in
 * the default slot - radios, a "download backup first" button - and a trap that
 * only knew about Cancel and Confirm would let Tab escape straight past them to
 * the page behind, which is exactly what aria-modal promises it won't.
 */
const focusableElements = (): HTMLElement[] =>
  dialogEl.value ? Array.from(dialogEl.value.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

// Document-level rather than bound to the backdrop: clicking any non-focusable
// part of the dialog moves focus to <body>, and a keydown there never reaches a
// handler on the backdrop, so Esc would quietly stop working.
const onKeydown = (event: KeyboardEvent) => {
  if (!props.open) return;

  if (event.key === "Escape") {
    emit("cancel");
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = focusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const index = focusable.indexOf(document.activeElement as HTMLElement);

  // Only intervene at the ends. In between, the browser's own order is right,
  // and preventing default there would break arrow/Tab behaviour inside inputs.
  if (!event.shiftKey && index === focusable.length - 1) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && index === 0) {
    event.preventDefault();
    last.focus();
  } else if (index === -1) {
    // Focus is somewhere outside the dialog - pull it back to the safe end.
    event.preventDefault();
    first.focus();
  }
};

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
}

.dialog {
  width: 100%;
  max-width: 460px;
  padding: 20px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  color: #333;
  font-size: 14px;
  line-height: 1.5;
}

.dialog-title {
  margin: 0 0 12px;
  font-size: 16px;
}

.dialog-title.danger {
  color: #b3383f;
}

.dialog-body {
  margin-bottom: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-actions button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f5f5f5;
  font-size: 13px;
  cursor: pointer;
}

.dialog-actions button:hover:not(:disabled) {
  filter: brightness(0.97);
}

.dialog-actions button:disabled {
  opacity: 0.55;
  cursor: default;
}

.dialog-confirm.danger {
  border-color: #b3383f;
  background: #b3383f;
  color: #fff;
}
</style>
