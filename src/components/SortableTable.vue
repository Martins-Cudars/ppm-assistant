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
  /**
   * Opt-in column grouping. When any column has a group, an extra header row
   * above the column headers merges consecutive same-group columns into one
   * labelled cell, and each group's first column gets a `group-start` class
   * for dividers. Tables that set no group render exactly as before.
   */
  group?: string;
  /** Opt-in inline style per cell, e.g. a heatmap background. */
  cellStyle?: (item: any) => Record<string, string> | undefined;
}

const props = defineProps<{
  columns: Column[];
  items: any[];
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /**
   * Opt-in: keep the header rows and the first column in view while the
   * surrounding scroll container scrolls. The container must have its own
   * overflow and height for this to take effect.
   */
  sticky?: boolean;
}>();

// Consecutive runs of same-group columns, for the group header row. Empty when
// no column is grouped, so ungrouped tables get no extra row.
const groupSpans = computed(() => {
  if (!props.columns.some((column) => column.group)) return [];

  const spans: { label: string; span: number }[] = [];
  props.columns.forEach((column) => {
    const label = column.group ?? "";
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.span++;
    else spans.push({ label, span: 1 });
  });
  return spans;
});

const isGroupStart = (index: number) =>
  groupSpans.value.length > 0 &&
  index > 0 &&
  props.columns[index].group !== props.columns[index - 1].group;

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
  <table
    cellspacing="0"
    cellpadding="2"
    :class="['table', { 'sortable-table--sticky': sticky, 'sortable-table--grouped': groupSpans.length > 0 }]"
  >
    <thead>
      <tr v-if="groupSpans.length > 0" class="group-row">
        <td
          v-for="(group, index) in groupSpans"
          :key="index"
          :colspan="group.span"
          :class="['group-header', { 'group-start': index > 0 }]"
        >
          {{ group.label }}
        </td>
      </tr>
      <tr class="column-row">
        <td
          v-for="(col, index) in columns"
          :key="index"
          :class="[
            getHeaderClass(index),
            { sortable: col.sortable, 'group-start': isGroupStart(index) },
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
          :class="[
            getCellClass(rowIndex, colIndex),
            col.cellClass,
            { 'group-start': isGroupStart(colIndex) },
          ]"
          :style="col.cellStyle?.(item)"
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

/*
 * Sticky header rows and first column. Opaque backgrounds are required, or
 * the scrolled content shows through. The column row sits below the group
 * row, so its offset is the group row's height.
 */
.sortable-table--sticky {
  --sortable-group-row-height: 22px;
}

.sortable-table--sticky thead td {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--sortable-header-bg, #fff);
}

.sortable-table--sticky.sortable-table--grouped .column-row td {
  top: var(--sortable-group-row-height);
}

.sortable-table--sticky tbody td:first-child,
.sortable-table--sticky .column-row td:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
}

.sortable-table--sticky .column-row td:first-child {
  z-index: 3;
}
</style>
