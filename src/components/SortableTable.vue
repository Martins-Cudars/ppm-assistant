<script setup lang="ts">
import { ref, computed } from "vue";

export interface Column {
  header: string;
  key?: string;
  sortable?: boolean;
  sortKey?: string; // Optional custom key for sorting (e.g. 'skills.goalie')
  sortValue?: (item: any) => any; // Function to get value for sorting
  slot?: string;
  align?: "left" | "center" | "right";
  headerClass?: string;
  cellClass?: string;
}

const props = defineProps<{
  columns: Column[];
  items: any[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
}>();

const currentSortKey = ref<string | null>(props.defaultSort?.key || null);
const currentSortDir = ref<"asc" | "desc">(props.defaultSort?.dir || "asc");

const sort = (column: Column) => {
  if (!column.sortable) return;

  const key = column.sortKey || column.key;
  if (!key) return;

  if (currentSortKey.value === key) {
    currentSortDir.value = currentSortDir.value === "asc" ? "desc" : "asc";
  } else {
    currentSortKey.value = key;
    currentSortDir.value = "asc";
  }
};

const sortedItems = computed(() => {
  if (!currentSortKey.value) return props.items;

  const key = currentSortKey.value;
  const dir = currentSortDir.value === "asc" ? 1 : -1;
  const column = props.columns.find(
    (c: Column) => (c.sortKey || c.key) === key
  );

  return [...props.items].sort((a, b) => {
    const getValue = (obj: any) => {
      if (column?.sortValue) return column.sortValue(obj);
      return key
        .split(".")
        .reduce((o: any, i: string) => (o ? o[i] : null), obj);
    };

    const valA = getValue(a);
    const valB = getValue(b);

    if (valA === valB) return 0;
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    // Numeric comparison if possible
    if (!isNaN(Number(valA)) && !isNaN(Number(valB))) {
      return (Number(valA) - Number(valB)) * dir;
    }

    return valA > valB ? dir : -dir;
  });
});

const getHeaderClass = (index: number) => {
  return index % 2 === 0 ? "th1" : "th2";
};

const getCellClass = (rowIndex: number, colIndex: number) => {
  const rowType = rowIndex % 2 === 0 ? "tr0" : "tr1";
  const cellType = colIndex % 2 === 0 ? "td1" : "td2";
  return `${rowType}${cellType}`;
};

const getItemValue = (item: any, key: string) => {
  return key.split(".").reduce((o: any, i: string) => (o ? o[i] : null), item);
};
</script>

<template>
  <table cellspacing="0" cellpadding="2" class="table">
    <thead>
      <tr>
        <td
          v-for="(col, index) in columns"
          :key="index"
          :class="[
            getHeaderClass(index),
            { sortable: col.sortable },
            col.headerClass,
          ]"
          @click="sort(col)"
          :align="col.align || 'left'"
        >
          {{ col.header }}
          <span v-if="currentSortKey === (col.sortKey || col.key)">
            {{ currentSortDir === "asc" ? "▲" : "▼" }}
          </span>
        </td>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(item, rowIndex) in sortedItems" :key="rowIndex">
        <td
          v-for="(col, colIndex) in columns"
          :key="colIndex"
          :class="[getCellClass(rowIndex, colIndex), col.cellClass]"
          :align="col.align || 'left'"
        >
          <slot
            v-if="col.slot"
            :name="col.slot"
            :item="item"
            :index="rowIndex"
          ></slot>
          <template v-else>
            {{ getItemValue(item, col.key!) }}
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.sortable {
  cursor: pointer;
}
</style>
