<script setup lang="ts">
import { onMounted } from "vue";
import type { User } from "@cantina/types";
import { formatCurrency } from "@cantina/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { signOut, token, user } from "@/lib/session";
import LoginView from "@/views/LoginView.vue";

onMounted(async () => {
  if (!token.value) return;
  const result = await api<User>("/auth/me");
  if (result.success) user.value = result.data;
  else signOut();
});
</script>

<template>
  <main v-if="user" class="flex min-h-svh items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Olá, {{ user.name }}</CardTitle>
        <CardDescription>
          {{ user.email }}<template v-if="user.role === 'ADMINISTRADOR'"> · Administrador</template>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground">Saldo</p>
        <p class="text-2xl font-semibold tabular-nums" :class="{ 'text-destructive': user.balance < 0 }">
          {{ formatCurrency(user.balance) }}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" class="w-full" @click="signOut">Sair</Button>
      </CardFooter>
    </Card>
  </main>
  <LoginView v-else-if="!token" />
</template>
