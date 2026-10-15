<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import { EllipsisIcon, PencilIcon, PlusIcon, PowerOffIcon, SearchIcon } from "@lucide/vue";
import type { Product } from "@cantina/types";
import { formatCurrency } from "@cantina/utils";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import PageHeader from "@/components/PageHeader.vue";
import ProductThumb from "@/components/ProductThumb.vue";
import ProductFormDialog from "@/components/admin/ProductFormDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, withQuery } from "@/lib/api";

const LOW_STOCK = 5;

const products = ref<Product[] | null>(null);
const allCategories = ref<string[]>([]);
const name = ref("");
const category = ref("all");
const status = ref<"true" | "false" | "all">("true");

const formOpen = ref(false);
const editing = ref<Product | null>(null);
const deactivating = ref<Product | null>(null);
const confirmOpen = ref(false);
const busy = ref(false);

const lowStockCount = computed(() => (products.value ?? []).filter((p) => p.active && p.stock <= LOW_STOCK).length);

let lastRequest = 0;

async function load() {
  const request = ++lastRequest;
  const result = await api<Product[]>(
    withQuery("/produtos", {
      name: name.value.trim(),
      category: category.value === "all" ? undefined : category.value,
      active: status.value === "all" ? undefined : status.value,
    }),
  );
  if (request !== lastRequest) return;
  if (!result.success) {
    toast.error(result.error);
    products.value = [];
    return;
  }
  products.value = result.data;
}

async function loadCategories() {
  const result = await api<Product[]>("/produtos");
  if (result.success) allCategories.value = [...new Set(result.data.map((p) => p.category))].sort();
}

watch([category, status], load);
watchDebounced(name, load, { debounce: 300 });
load();
loadCategories();

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(product: Product) {
  editing.value = product;
  formOpen.value = true;
}

function askDeactivate(product: Product) {
  deactivating.value = product;
  confirmOpen.value = true;
}

async function deactivate() {
  if (!deactivating.value) return;
  busy.value = true;
  const result = await api<Product>(`/produtos/${deactivating.value.id}`, { method: "DELETE" });
  busy.value = false;
  confirmOpen.value = false;
  if (!result.success) return toast.error(result.error);
  toast.success("Produto inativado", { description: result.data.name });
  load();
}

function onSaved() {
  load();
  loadCategories();
}
</script>

<template>
  <PageHeader title="Produtos" description="Cadastre e gerencie os produtos e o estoque da cantina.">
    <Button @click="openCreate"><PlusIcon /> Novo produto</Button>
  </PageHeader>

  <Card>
    <CardContent class="grid gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-48 flex-1">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="name" placeholder="Buscar por nome" class="pl-8" aria-label="Buscar por nome" />
        </div>
        <Select v-model="category">
          <SelectTrigger class="w-44" aria-label="Categoria"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            <SelectItem v-for="c in allCategories" :key="c" :value="c">{{ c }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="status">
          <SelectTrigger class="w-36" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p v-if="lowStockCount" class="text-sm text-amber-700 dark:text-amber-400">
        {{ lowStockCount }} {{ lowStockCount === 1 ? "produto ativo está" : "produtos ativos estão" }} com estoque baixo
        (até {{ LOW_STOCK }} unidades).
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead class="hidden sm:table-cell">Categoria</TableHead>
            <TableHead class="text-right">Preço</TableHead>
            <TableHead class="text-right">Estoque</TableHead>
            <TableHead class="w-10"><span class="sr-only">Ações</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="!products" :colspan="5">Carregando...</TableEmpty>
          <TableEmpty v-else-if="products.length === 0" :colspan="5">Nenhum produto encontrado.</TableEmpty>
          <TableRow v-for="product in products" v-else :key="product.id" :class="{ 'opacity-60': !product.active }">
            <TableCell>
              <div class="flex items-center gap-3">
                <ProductThumb :photo="product.photo" :name="product.name" />
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ product.name }}</p>
                  <Badge v-if="!product.active" variant="outline">Inativo</Badge>
                  <p v-else class="text-xs text-muted-foreground sm:hidden">{{ product.category }}</p>
                </div>
              </div>
            </TableCell>
            <TableCell class="hidden sm:table-cell">{{ product.category }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatCurrency(product.price) }}</TableCell>
            <TableCell class="text-right tabular-nums">
              <Badge v-if="product.stock === 0" variant="destructive">Esgotado</Badge>
              <span
                v-else
                :class="{ 'font-medium text-amber-700 dark:text-amber-400': product.active && product.stock <= LOW_STOCK }"
              >
                {{ product.stock }}
              </span>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm" :aria-label="`Ações para ${product.name}`">
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="openEdit(product)"><PencilIcon /> Editar</DropdownMenuItem>
                  <DropdownMenuItem v-if="product.active" variant="destructive" @select="askDeactivate(product)">
                    <PowerOffIcon /> Inativar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>

  <ProductFormDialog v-model:open="formOpen" :product="editing" :categories="allCategories" @saved="onSaved" />

  <ConfirmDialog
    v-model:open="confirmOpen"
    title="Inativar produto?"
    :description="`${deactivating?.name ?? ''} deixará de aparecer para venda. Os dados e o histórico de vendas serão mantidos.`"
    confirm-label="Inativar"
    destructive
    :busy="busy"
    @confirm="deactivate"
  />
</template>
