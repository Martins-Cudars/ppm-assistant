<template>
  <div class="ppm-contracts-table">
    <SortableTable :columns="columns" :items="items">
      <template #name="{ item }">
        <span v-html="item.nameHtml"></span>
      </template>
      <template #alp="{ item }">
        <input
          type="checkbox"
          :checked="item.alpEnabled"
          @change="toggleAlp(item.alpHref)"
          class="alp-checkbox"
        />
      </template>
    </SortableTable>
  </div>
</template>

<script setup lang="ts">
import SortableTable from "@/components/SortableTable.vue";

defineProps<{
  items: any[];
  columns: any[];
}>();

const toggleAlp = (href: string) => {
  if (href) {
    window.location.href = href;
  }
};
</script>

<style scoped>
.ppm-contracts-table {
  margin-top: 20px;
}

:deep(.text-left) {
  text-align: left !important;
  padding-left: 10px !important;
}

.alp-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
}
</style>
