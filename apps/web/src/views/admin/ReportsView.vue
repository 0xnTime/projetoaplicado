<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import type { ConsumptionReport, ProductSales, ReportGrouping, SalesReport, User } from "@cantina/types";
import { formatCurrency } from "@cantina/utils";
import PageHeader from "@/components/PageHeader.vue";
import PeriodFilter from "@/components/PeriodFilter.vue";
import SalesChart from "@/components/admin/SalesChart.vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, withQuery } from "@/lib/api";
import { formatPeriod } from "@/lib/labels";
import type { Period } from "@/lib/period";

type Tab = "vendas" | "produtos" | "consumo";

const route = useRoute();
const router = useRouter();

const tabs: Tab[] = ["vendas", "produtos", "consumo"];
const tab = ref<Tab>(tabs.includes(route.query.aba as Tab) ? (route.query.aba as Tab) : "vendas");
const period = ref<Period>({});
const groupBy = ref<ReportGrouping>("day");
const topLimit = ref("10");
const consumerId = ref<string | undefined>(typeof route.query.usuario === "string" ? route.query.usuario : undefined);

const sales = ref<SalesReport | null>(null);
const topProducts = ref<ProductSales[] | null>(null);
const consumers = ref<User[]>([]);
const consumption = ref<ConsumptionReport | null>(null);
const loadingConsumption = ref(false);

const averageTicket = computed(() =>
  sales.value && sales.value.salesCount ? sales.value.revenue / sales.value.salesCount : 0,
);
const topMax = computed(() => Math.max(...(topProducts.value ?? []).map((p) => p.quantity), 1));
const consumptionMax = computed(() => Math.max(...(consumption.value?.products ?? []).map((p) => p.quantity), 1));

const requests = { sales: 0, top: 0, consumption: 0 };

async function loadSales() {
  const request = ++requests.sales;
  sales.value = null;
  const result = await api<SalesReport>(
    withQuery("/relatorios/vendas", { ...period.value, groupBy: groupBy.value }),
  );
  if (request !== requests.sales) return;
  if (result.success) sales.value = result.data;
  else toast.error(result.error);
}

async function loadTopProducts() {
  const request = ++requests.top;
  topProducts.value = null;
  const result = await api<ProductSales[]>(
    withQuery("/relatorios/produtos-mais-vendidos", {
      ...period.value,
      limit: topLimit.value === "all" ? undefined : topLimit.value,
    }),
  );
  if (request !== requests.top) return;
  if (result.success) topProducts.value = result.data;
  else toast.error(result.error);
}

async function loadConsumption() {
  const request = ++requests.consumption;
  consumption.value = null;
  loadingConsumption.value = !!consumerId.value;
  if (!consumerId.value) return;
  const result = await api<ConsumptionReport>(withQuery(`/relatorios/consumo/${consumerId.value}`, { ...period.value }));
  if (request !== requests.consumption) return;
  loadingConsumption.value = false;
  if (result.success) consumption.value = result.data;
  else toast.error(result.error);
}

async function loadConsumers() {
  const result = await api<User[]>("/usuarios?role=CONSUMIDOR");
  if (result.success) consumers.value = result.data;
}

watch([period, groupBy], loadSales, { immediate: true });
watch([period, topLimit], loadTopProducts, { immediate: true });
watch([period, consumerId], loadConsumption, { immediate: true });
watch([tab, consumerId], () =>
  router.replace({ query: { aba: tab.value, usuario: tab.value === "consumo" ? consumerId.value : undefined } }),
);
loadConsumers();
</script>

<template>
  <PageHeader title="Relatórios" description="Acompanhe vendas, produtos e o consumo de cada consumidor.">
    <PeriodFilter v-model="period" initial-mode="month" />
  </PageHeader>

  <Tabs v-model="tab">
    <TabsList class="mb-4">
      <TabsTrigger value="vendas">Vendas</TabsTrigger>
      <TabsTrigger value="produtos">Mais vendidos</TabsTrigger>
      <TabsTrigger value="consumo">Consumo</TabsTrigger>
    </TabsList>

    <TabsContent value="vendas" class="grid gap-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p class="text-sm text-muted-foreground">Total arrecadado</p>
            <Skeleton v-if="!sales" class="mt-1 h-8 w-32" />
            <p v-else class="mt-1 text-2xl font-semibold tabular-nums">{{ formatCurrency(sales.revenue) }}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p class="text-sm text-muted-foreground">Quantidade de vendas</p>
            <Skeleton v-if="!sales" class="mt-1 h-8 w-16" />
            <p v-else class="mt-1 text-2xl font-semibold tabular-nums">{{ sales.salesCount }}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p class="text-sm text-muted-foreground">Ticket médio</p>
            <Skeleton v-if="!sales" class="mt-1 h-8 w-24" />
            <p v-else class="mt-1 text-2xl font-semibold tabular-nums">{{ formatCurrency(averageTicket) }}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Arrecadação por período</CardTitle>
            <CardDescription>Valor total vendido em cada período</CardDescription>
          </div>
          <Select v-model="groupBy">
            <SelectTrigger class="w-36" aria-label="Agrupar por"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Por dia</SelectItem>
              <SelectItem value="month">Por mês</SelectItem>
              <SelectItem value="year">Por ano</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent class="grid gap-6">
          <Skeleton v-if="!sales" class="h-56" />
          <p v-else-if="sales.periods.length === 0" class="py-10 text-center text-sm text-muted-foreground">
            Nenhuma venda no período selecionado.
          </p>
          <template v-else>
            <SalesChart :periods="sales.periods" :group-by="groupBy" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead class="text-right">Vendas</TableHead>
                  <TableHead class="text-right">Arrecadado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="p in [...sales.periods].reverse()" :key="p.period">
                  <TableCell>{{ formatPeriod(p.period, groupBy) }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ p.salesCount }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ formatCurrency(p.revenue) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="produtos">
      <Card>
        <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Produtos mais vendidos</CardTitle>
            <CardDescription>Quantidade vendida de cada produto no período</CardDescription>
          </div>
          <Select v-model="topLimit">
            <SelectTrigger class="w-32" aria-label="Quantidade de produtos"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-10">#</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead class="hidden w-1/3 md:table-cell"><span class="sr-only">Proporção</span></TableHead>
                <TableHead class="text-right">Qtd.</TableHead>
                <TableHead class="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!topProducts" :colspan="5">Carregando...</TableEmpty>
              <TableEmpty v-else-if="topProducts.length === 0" :colspan="5">Nenhuma venda no período selecionado.</TableEmpty>
              <TableRow v-for="(p, i) in topProducts" v-else :key="p.productId">
                <TableCell class="text-muted-foreground tabular-nums">{{ i + 1 }}</TableCell>
                <TableCell>
                  <p class="font-medium">{{ p.name }}</p>
                  <p class="text-xs text-muted-foreground">{{ p.category }}</p>
                </TableCell>
                <TableCell class="hidden md:table-cell">
                  <div class="h-2 rounded-r-[4px] bg-chart-1" :style="{ width: `${(p.quantity / topMax) * 100}%` }" />
                </TableCell>
                <TableCell class="text-right tabular-nums">{{ p.quantity }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ formatCurrency(p.revenue) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="consumo" class="grid gap-4">
      <Card size="sm">
        <CardContent class="flex flex-wrap items-center gap-3">
          <Label for="consumer">Consumidor</Label>
          <Select v-model="consumerId">
            <SelectTrigger id="consumer" class="w-full sm:w-80">
              <SelectValue placeholder="Selecione um consumidor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in consumers" :key="c.id" :value="String(c.id)">
                {{ c.name }} <span class="text-muted-foreground">· {{ c.email }}</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card v-if="!consumerId">
        <CardContent class="py-10 text-center text-sm text-muted-foreground">
          Selecione um consumidor para ver o total gasto e os produtos adquiridos.
        </CardContent>
      </Card>
      <Skeleton v-else-if="loadingConsumption" class="h-64" />
      <template v-else-if="consumption">
        <div class="grid gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardContent>
              <p class="text-sm text-muted-foreground">Total gasto</p>
              <p class="mt-1 text-2xl font-semibold tabular-nums">{{ formatCurrency(consumption.total) }}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <p class="text-sm text-muted-foreground">Compras realizadas</p>
              <p class="mt-1 text-2xl font-semibold tabular-nums">{{ consumption.purchaseCount }}</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Produtos adquiridos</CardTitle>
            <CardDescription>{{ consumption.user.name }} · {{ consumption.user.email }}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead class="hidden w-1/3 md:table-cell"><span class="sr-only">Proporção</span></TableHead>
                  <TableHead class="text-right">Qtd.</TableHead>
                  <TableHead class="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmpty v-if="consumption.products.length === 0" :colspan="4">
                  Nenhuma compra no período selecionado.
                </TableEmpty>
                <TableRow v-for="p in consumption.products" :key="p.productId">
                  <TableCell>
                    <p class="font-medium">{{ p.name }}</p>
                    <p class="text-xs text-muted-foreground">{{ p.category }}</p>
                  </TableCell>
                  <TableCell class="hidden md:table-cell">
                    <div class="h-2 rounded-r-[4px] bg-chart-1" :style="{ width: `${(p.quantity / consumptionMax) * 100}%` }" />
                  </TableCell>
                  <TableCell class="text-right tabular-nums">{{ p.quantity }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ formatCurrency(p.revenue) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </template>
    </TabsContent>
  </Tabs>
</template>
