<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import type { Purchase, Topup } from "@cantina/types";
import { formatCurrency, formatDateTime } from "@cantina/utils";
import PageHeader from "@/components/PageHeader.vue";
import PeriodFilter from "@/components/PeriodFilter.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, withQuery } from "@/lib/api";
import { paymentMethodLabels } from "@/lib/labels";
import type { Period } from "@/lib/period";

const route = useRoute();
const tab = ref(route.query.aba === "recargas" ? "recargas" : "compras");
const period = ref<Period>({});
const purchases = ref<Purchase[] | null>(null);
const topups = ref<Topup[] | null>(null);

const sumCents = (values: number[]) => values.reduce((sum, v) => sum + Math.round(v * 100), 0) / 100;
const purchasesTotal = computed(() => sumCents((purchases.value ?? []).map((p) => p.total)));
const topupsTotal = computed(() => sumCents((topups.value ?? []).map((t) => t.amount)));

let lastRequest = 0;

async function load() {
  const request = ++lastRequest;
  purchases.value = null;
  topups.value = null;
  const [purchaseResult, topupResult] = await Promise.all([
    api<Purchase[]>(withQuery("/compras", { ...period.value })),
    api<Topup[]>(withQuery("/recargas", { ...period.value })),
  ]);
  if (request !== lastRequest) return;
  purchases.value = purchaseResult.success ? purchaseResult.data : [];
  topups.value = topupResult.success ? topupResult.data : [];
  if (!purchaseResult.success) toast.error(purchaseResult.error);
  else if (!topupResult.success) toast.error(topupResult.error);
}

watch(period, load, { immediate: true });
</script>

<template>
  <PageHeader title="Histórico" description="Suas compras e recargas na cantina.">
    <PeriodFilter v-model="period" />
  </PageHeader>

  <Tabs v-model="tab">
    <TabsList class="mb-4">
      <TabsTrigger value="compras">Compras</TabsTrigger>
      <TabsTrigger value="recargas">Recargas</TabsTrigger>
    </TabsList>

    <TabsContent value="compras" class="grid gap-4">
      <div v-if="!purchases" class="grid gap-4">
        <Skeleton v-for="i in 3" :key="i" class="h-32" />
      </div>
      <template v-else>
        <p class="text-sm text-muted-foreground">
          {{ purchases.length }} {{ purchases.length === 1 ? "compra" : "compras" }} ·
          total de <span class="font-medium text-foreground tabular-nums">{{ formatCurrency(purchasesTotal) }}</span>
        </p>
        <Card v-if="purchases.length === 0">
          <CardContent class="py-6 text-center text-sm text-muted-foreground">
            Nenhuma compra no período selecionado.
          </CardContent>
        </Card>
        <Card v-for="purchase in purchases" :key="purchase.id" size="sm">
          <CardHeader class="flex-row items-center justify-between">
            <CardTitle class="text-sm font-medium">{{ formatDateTime(purchase.createdAt) }}</CardTitle>
            <span class="text-xs text-muted-foreground">Compra nº {{ purchase.id }}</span>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead class="text-right">Qtd.</TableHead>
                  <TableHead class="text-right">Valor unit.</TableHead>
                  <TableHead class="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in purchase.items" :key="item.productId">
                  <TableCell class="whitespace-normal">{{ item.name }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ item.quantity }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ formatCurrency(item.unitPrice) }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ formatCurrency(item.unitPrice * item.quantity) }}</TableCell>
                </TableRow>
                <TableRow class="hover:bg-transparent">
                  <TableCell colspan="3" class="text-right font-medium">Total</TableCell>
                  <TableCell class="text-right font-semibold tabular-nums">{{ formatCurrency(purchase.total) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </template>
    </TabsContent>

    <TabsContent value="recargas">
      <Card>
        <CardContent>
          <div v-if="!topups" class="grid gap-3">
            <Skeleton v-for="i in 4" :key="i" class="h-10" />
          </div>
          <template v-else>
            <p class="mb-3 text-sm text-muted-foreground">
              {{ topups.length }} {{ topups.length === 1 ? "recarga" : "recargas" }} ·
              total de <span class="font-medium text-foreground tabular-nums">{{ formatCurrency(topupsTotal) }}</span>
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Forma de pagamento</TableHead>
                  <TableHead class="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="topup in topups" :key="topup.id">
                  <TableCell>{{ formatDateTime(topup.createdAt) }}</TableCell>
                  <TableCell>{{ paymentMethodLabels[topup.paymentMethod] }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ formatCurrency(topup.amount) }}</TableCell>
                </TableRow>
                <TableEmpty v-if="topups.length === 0" :colspan="3">Nenhuma recarga no período selecionado.</TableEmpty>
              </TableBody>
            </Table>
          </template>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</template>
