<script setup lang="ts">
import { computed } from "vue";
import { RatingSettings } from "@/types/Position";

const props = defineProps<{
  skill: number;
  settings: RatingSettings;
}>();

const ratingState = computed(() => {
  const { low, medium, high } = props.settings;

  if (props.skill < low) {
    return {
      outerImage: "icons/star-empty.svg",
      innerImage: "icons/star-silver.svg",
      percentage: Math.min((props.skill / low) * 100, 100),
    };
  } else if (props.skill < medium) {
    return {
      outerImage: "icons/star-silver.svg",
      innerImage: "icons/star-gold.svg",
      percentage: Math.min(((props.skill - low) / (medium - low)) * 100, 100),
    };
  } else {
    return {
      outerImage: "icons/star-gold.svg",
      innerImage: "icons/star-diamond.svg",
      percentage: Math.min(
        ((props.skill - medium) / (high - medium)) * 100,
        100
      ),
    };
  }
});

const getUrl = (path: string) => chrome.runtime.getURL(path);
</script>

<template>
  <span
    class="rating"
    :style="{ backgroundImage: `url(${getUrl(ratingState.outerImage)})` }"
  >
    <span
      class="rating__inner"
      :style="{
        backgroundImage: `url(${getUrl(ratingState.innerImage)})`,
        width: `${ratingState.percentage}%`,
      }"
    ></span>
  </span>
</template>

<style scoped>
/* Assuming global styles handle .rating and .rating__inner dimensions, 
   but providing defaults just in case or if scoped is preferred. 
   The original code added classes 'rating' and 'rating__inner'. 
*/
.rating {
  display: inline-block;
  width: 80px; /* Increased to ensure 5 stars fit if they are larger, or just to be safe */
  height: 16px; /* Adjusted height to match icon size usually */
  background-repeat: repeat-x;
  position: relative;
  vertical-align: middle;
}

.rating__inner {
  display: block;
  height: 100%;
  background-repeat: repeat-x;
  position: absolute;
  top: 0;
  left: 0;
}
</style>
