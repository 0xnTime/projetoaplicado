<script setup lang="ts">
import { reactive, watch } from "vue";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialPeriodState, periodRange, type Period, type PeriodMode } from "@/lib/period";

const props = withDefaults(defineProps<{ initialMode?: PeriodMode }>(), { initialMode: "all" });
const period = defineModel<Period>({ required: true });

const modes: { value: PeriodMode; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "day", label: "Dia" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "range", label: "Intervalo" },
];

const state = reactive(initialPeriodState(props.initialMode));

watch(
  state,
  () => {
    const next = periodRange(state);
    if (next.from !== period.value.from || next.to !== period.value.to) period.value = next;
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Select v-model="state.mode">
      <SelectTrigger class="w-40" aria-label="Período">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="mode in modes" :key="mode.value" :value="mode.value">{{ mode.label }}</SelectItem>
      </SelectContent>
    </Select>
    <Input v-if="state.mode === 'day'" v-model="state.day" type="date" class="w-40" aria-label="Dia" />
    <Input v-else-if="state.mode === 'month'" v-model="state.month" type="month" class="w-40" aria-label="Mês" />
    <Input
      v-else-if="state.mode === 'year'"
      v-model="state.year"
      type="number"
      min="2000"
      max="2100"
      class="w-28"
      aria-label="Ano"
    />
    <template v-else-if="state.mode === 'range'">
      <Input v-model="state.from" type="date" class="w-40" aria-label="De" />
      <span class="text-sm text-muted-foreground">até</span>
      <Input v-model="state.to" type="date" :min="state.from || undefined" class="w-40" aria-label="Até" />
    </template>
  </div>
</template>
