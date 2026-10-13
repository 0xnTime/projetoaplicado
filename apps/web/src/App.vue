<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { ApiResult, Hello } from "@cantina/types";
import { formatDateTime } from "@cantina/utils";

const hello = ref<Hello | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const res = await fetch("/api/hello");
    const result = (await res.json()) as ApiResult<Hello>;
    if (result.success) hello.value = result.data;
    else error.value = result.error;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <main>
    <h1>Hello World</h1>
    <template v-if="hello">
      <p>{{ hello.message }}</p>
      <p>Hora do banco: {{ formatDateTime(hello.dbTime) }}</p>
    </template>
    <p v-else-if="error">Erro ao falar com o servidor: {{ error }}</p>
    <p v-else>Carregando...</p>
  </main>
</template>

<style scoped>
main {
  font-family: system-ui, sans-serif;
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1rem;
}
</style>
