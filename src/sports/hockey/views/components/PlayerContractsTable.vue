<template>
  <div class="ppm-contracts-table">
    <SortableTable :columns="columns" :items="items">
      <template #name="{ item }">
        <span v-html="item.nameHtml"></span>
      </template>
      <template #alp="{ item }">
        <!-- Placeholder for checkbox -->
        <span></span>
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
</script>

<style scoped>
.ppm-contracts-table {
  margin-top: 20px;
}

:deep(.text-left) {
  text-align: left !important;
  padding-left: 10px !important; /* Adding some padding for better look */
}
</style>
