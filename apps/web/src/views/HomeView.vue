<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ArrowRightIcon, ShoppingBasketIcon, TriangleAlertIcon, WalletIcon } from "@lucide/vue";
import type { Purchase } from "@cantina/types";
import { formatCurrency, formatDateTime } from "@cantina/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { refreshUser, user } from "@/lib/session";

const purchases = ref<Purchase[] | null>(null);

onMounted(async () => {
  refreshUser();
  const result = await api<Purchase[]>("/compras");
  purchases.value = result.success ? result.data.slice(0, 5) : [];
});
</script>

<template>
  <div v-if="user" class="grid gap-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Olá, {{ user.name.split(" ")[0] }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">Bem-vindo à Cantina da Honestidade.</p>
    </div>

    <Card>
      <CardContent class="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p class="text-sm text-muted-foreground">Saldo da carteira</p>
          <p
            class="mt-1 text-4xl font-semibold tracking-tight tabular-nums"
            :class="{ 'text-destructive': user.balance < 0 }"
          >
            {{ formatCurrency(user.balance) }}
          </p>
          <p v-if="user.balance < 0" class="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <TriangleAlertIcon class="size-4" />
            Seu saldo está negativo. Faça uma recarga para regularizar.
          </p>
        </div>
        <div class="flex w-full gap-2 sm:w-auto">
          <Button as-child size="lg" class="flex-1 sm:flex-none">
            <RouterLink :to="{ name: 'purchase' }"><ShoppingBasketIcon /> Comprar</RouterLink>
          </Button>
          <Button as-child size="lg" variant="outline" class="flex-1 sm:flex-none">
            <RouterLink :to="{ name: 'wallet' }"><WalletIcon /> Recarregar</RouterLink>
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Últimas compras</CardTitle>
        <CardDescription>Suas compras mais recentes na cantina</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="!purchases" class="grid gap-3">
          <Skeleton v-for="i in 3" :key="i" class="h-12" />
        </div>
        <p v-else-if="purchases.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Você ainda não fez nenhuma compra.
        </p>
        <ul v-else class="divide-y">
          <li v-for="purchase in purchases" :key="purchase.id" class="flex items-center justify-between gap-4 py-3">
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ purchase.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") }}
              </p>
              <p class="text-xs text-muted-foreground">{{ formatDateTime(purchase.createdAt) }}</p>
            </div>
            <span class="shrink-0 font-semibold tabular-nums">{{ formatCurrency(purchase.total) }}</span>
          </li>
        </ul>
        <Button v-if="purchases?.length" as-child variant="link" class="mt-2 px-0">
          <RouterLink :to="{ name: 'history' }">Ver histórico completo <ArrowRightIcon /></RouterLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
