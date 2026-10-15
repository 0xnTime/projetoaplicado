<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { PackageIcon } from "@lucide/vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ photo: string | null; name: string; class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div :class="cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted', props.class)">
    <img v-if="photo" :src="photo" :alt="name" class="size-full object-cover" loading="lazy" />
    <PackageIcon v-else class="size-1/2 text-muted-foreground" aria-hidden="true" />
  </div>
</template>
