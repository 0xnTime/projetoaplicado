<script setup lang="ts">
import { watch } from "vue";
import { useRouter } from "vue-router";
import { Toaster } from "@/components/ui/sonner";
import { token } from "@/lib/session";

const router = useRouter();

watch(token, (value) => {
  if (!value) router.replace({ name: "login" });
});
</script>

<template>
  <RouterView />
  <Toaster position="top-center" />
</template>
