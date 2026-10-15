<script setup lang="ts">
import { computed } from "vue";
import type { ReportGrouping, SalesPeriod } from "@cantina/types";
import { formatCurrency } from "@cantina/utils";
import { formatPeriod } from "@/lib/labels";

const props = defineProps<{ periods: SalesPeriod[]; groupBy: ReportGrouping }>();

const max = computed(() => Math.max(...props.periods.map((p) => p.revenue), 0));
const ticks = computed(() => {
  if (max.value <= 0) return [0];
  const rough = max.value / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  const top = Math.ceil(max.value / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
});
const top = computed(() => ticks.value[ticks.value.length - 1] || 1);

const labelEvery = computed(() => Math.max(1, Math.ceil(props.periods.length / 8)));
const short = (period: string) => {
  const label = formatPeriod(period, props.groupBy);
  return props.groupBy === "day" ? label.slice(0, 5) : label;
};
</script>

<template>
  <figure class="grid gap-2" aria-label="Valor arrecadado por período">
    <div class="flex gap-2">
      <div class="relative h-56 w-16 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        <span
          v-for="tick in ticks"
          :key="tick"
          class="absolute right-0 translate-y-1/2"
          :style="{ bottom: `${(tick / top) * 100}%` }"
        >
          {{ formatCurrency(tick).replace(",00", "") }}
        </span>
      </div>

      <div class="min-w-0 flex-1 overflow-x-auto">
        <div class="relative h-56" :style="{ minWidth: `${periods.length * 10}px` }">
          <div
            v-for="tick in ticks"
            :key="tick"
            class="absolute inset-x-0 border-t"
            :class="tick === 0 ? 'border-foreground/30' : 'border-dashed border-foreground/10'"
            :style="{ bottom: `${(tick / top) * 100}%` }"
          />
          <div class="absolute inset-0 flex items-end gap-0.5">
            <div
              v-for="(p, i) in periods"
              :key="p.period"
              class="group relative flex h-full max-w-14 min-w-2 flex-1 items-end justify-center"
              tabindex="0"
              :aria-label="`${formatPeriod(p.period, groupBy)}: ${formatCurrency(p.revenue)}, ${p.salesCount} vendas`"
            >
              <div
                class="w-full rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                :style="{ height: `${(p.revenue / top) * 100}%` }"
              />
              <div
                class="pointer-events-none absolute top-1 z-10 hidden w-max rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
                :class="i < periods.length / 2 ? 'left-0' : 'right-0'"
              >
                <p class="font-medium">{{ formatPeriod(p.period, groupBy) }}</p>
                <p class="tabular-nums">{{ formatCurrency(p.revenue) }}</p>
                <p class="text-muted-foreground">{{ p.salesCount }} {{ p.salesCount === 1 ? "venda" : "vendas" }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-1 flex gap-0.5 text-[11px] text-muted-foreground" :style="{ minWidth: `${periods.length * 10}px` }">
          <span v-for="(p, i) in periods" :key="p.period" class="max-w-14 min-w-2 flex-1 overflow-visible text-center whitespace-nowrap">
            {{ i % labelEvery === 0 ? short(p.period) : "" }}
          </span>
        </div>
      </div>
    </div>
  </figure>
</template>
