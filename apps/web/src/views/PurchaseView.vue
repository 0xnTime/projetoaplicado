<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import {
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "@lucide/vue";
import type { Product, Purchase } from "@cantina/types";
import { formatCurrency } from "@cantina/utils";
import PageHeader from "@/components/PageHeader.vue";
import ProductThumb from "@/components/ProductThumb.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { refreshUser, user } from "@/lib/session";

interface CartItem {
  product: Product;
  quantity: number;
}

const products = ref<Product[] | null>(null);
const cart = ref<CartItem[]>([]);
const search = ref("");
const category = ref<string | null>(null);
const lastAddedId = ref<number | null>(null);
const checkoutOpen = ref(false);
const checkoutError = ref<string | null>(null);
const submitting = ref(false);

const totalCents = computed(() =>
  cart.value.reduce((sum, item) => sum + Math.round(item.product.price * 100) * item.quantity, 0),
);
const total = computed(() => totalCents.value / 100);
const itemCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0));
const balanceAfter = computed(() => (Math.round((user.value?.balance ?? 0) * 100) - totalCents.value) / 100);

const categories = computed(() => [...new Set((products.value ?? []).map((p) => p.category))].sort());

const filteredProducts = computed(() => {
  const term = search.value.trim().toLowerCase();
  return (products.value ?? []).filter(
    (p) =>
      (!category.value || p.category === category.value) &&
      (!term || p.name.toLowerCase().includes(term)),
  );
});

async function loadProducts() {
  const result = await api<Product[]>("/produtos");
  if (result.success) {
    products.value = result.data;
    const byId = new Map(result.data.map((p) => [p.id, p]));
    cart.value = cart.value.flatMap((item) => {
      const product = byId.get(item.product.id);
      return product ? [{ product, quantity: Math.min(item.quantity, product.stock) }] : [];
    }).filter((item) => item.quantity > 0);
  } else {
    products.value = [];
    toast.error(result.error);
  }
}

function quantityInCart(product: Product) {
  return cart.value.find((item) => item.product.id === product.id)?.quantity ?? 0;
}

function addToCart(product: Product) {
  const item = cart.value.find((i) => i.product.id === product.id);
  const quantity = (item?.quantity ?? 0) + 1;
  if (quantity > product.stock) {
    toast.error(`Estoque insuficiente para ${product.name}`, {
      description: product.stock === 0 ? "Produto esgotado" : `Disponível: ${product.stock}`,
    });
    return;
  }
  if (item) item.quantity = quantity;
  else cart.value.push({ product, quantity });

  lastAddedId.value = product.id;
  toast.success(product.name, {
    description: `${formatCurrency(product.price)} · ${quantity} no carrinho · Total ${formatCurrency(total.value)}`,
  });
}

function changeQuantity(item: CartItem, delta: number) {
  if (delta > 0) return addToCart(item.product);
  if (item.quantity <= 1) return removeFromCart(item);
  item.quantity -= 1;
}

function removeFromCart(item: CartItem) {
  cart.value = cart.value.filter((i) => i !== item);
}

function openCheckout() {
  checkoutError.value = null;
  checkoutOpen.value = true;
}

async function confirmPurchase() {
  submitting.value = true;
  checkoutError.value = null;
  const result = await api<Purchase>("/compras", {
    method: "POST",
    body: { items: cart.value.map((item) => ({ productId: item.product.id, quantity: item.quantity })) },
  });
  submitting.value = false;
  if (!result.success) {
    checkoutError.value = result.error;
    loadProducts();
    return;
  }
  checkoutOpen.value = false;
  cart.value = [];
  lastAddedId.value = null;
  await Promise.all([refreshUser(), loadProducts()]);
  toast.success("Compra finalizada", {
    description: `${formatCurrency(result.data.total)} debitado da carteira. Saldo atual: ${formatCurrency(user.value?.balance ?? 0)}`,
  });
}

onMounted(() => {
  loadProducts();
  refreshUser();
});
</script>

<template>
  <PageHeader title="Comprar" description="Escolha os produtos, confira o carrinho e confirme a compra." />

  <div class="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
    <Card class="lg:col-start-1 lg:row-start-1">
      <CardHeader>
        <CardTitle>Produtos disponíveis</CardTitle>
        <CardDescription>Toque no produto para adicioná-lo ao carrinho.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-4">
        <div class="relative">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" placeholder="Buscar por nome" class="pl-8" aria-label="Buscar produto" />
        </div>
        <div v-if="categories.length > 1" class="flex flex-wrap gap-1.5">
          <Button size="sm" :variant="category === null ? 'default' : 'outline'" @click="category = null">Todos</Button>
          <Button
            v-for="c in categories"
            :key="c"
            size="sm"
            :variant="category === c ? 'default' : 'outline'"
            @click="category = c"
          >
            {{ c }}
          </Button>
        </div>

        <div v-if="!products" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton v-for="i in 6" :key="i" class="h-40" />
        </div>
        <p v-else-if="filteredProducts.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </p>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="product in filteredProducts"
            :key="product.id"
            type="button"
            class="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition hover:border-foreground/30 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="product.stock === 0 || quantityInCart(product) >= product.stock"
            @click="addToCart(product)"
          >
            <ProductThumb :photo="product.photo" :name="product.name" class="aspect-[4/3] size-auto w-full rounded-none" />
            <Badge v-if="quantityInCart(product)" class="absolute top-2 right-2">{{ quantityInCart(product) }}</Badge>
            <div class="flex flex-1 flex-col gap-1 p-3">
              <span class="line-clamp-2 text-sm font-medium">{{ product.name }}</span>
              <span class="mt-auto flex items-center justify-between gap-2">
                <span class="font-semibold tabular-nums">{{ formatCurrency(product.price) }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ product.stock === 0 ? "Esgotado" : `${product.stock} un.` }}
                </span>
              </span>
            </div>
          </button>
        </div>
      </CardContent>
    </Card>
    <Card class="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ShoppingCartIcon class="size-4" /> Carrinho
          <Badge v-if="itemCount" variant="secondary">{{ itemCount }}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p v-if="cart.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Nenhum produto no carrinho.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="item in cart"
            :key="item.product.id"
            class="flex items-center gap-3 py-2.5 transition-colors"
            :class="{ 'animate-in fade-in': item.product.id === lastAddedId }"
          >
            <ProductThumb :photo="item.product.photo" :name="item.product.name" class="size-9" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ item.product.name }}</p>
              <p class="text-xs text-muted-foreground tabular-nums">{{ formatCurrency(item.product.price) }} cada</p>
            </div>
            <div class="flex items-center gap-1">
              <Button size="icon-xs" variant="outline" aria-label="Diminuir" @click="changeQuantity(item, -1)">
                <MinusIcon />
              </Button>
              <span class="w-6 text-center text-sm tabular-nums">{{ item.quantity }}</span>
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="Aumentar"
                :disabled="item.quantity >= item.product.stock"
                @click="changeQuantity(item, 1)"
              >
                <PlusIcon />
              </Button>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="Remover do carrinho" @click="removeFromCart(item)">
              <Trash2Icon class="text-muted-foreground" />
            </Button>
          </li>
        </ul>
      </CardContent>
      <CardFooter class="flex-col items-stretch gap-3 border-t bg-muted/50 py-4">
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground">Total</span>
          <span class="text-xl font-semibold tabular-nums">{{ formatCurrency(total) }}</span>
        </div>
        <Button size="lg" :disabled="cart.length === 0" @click="openCheckout">Finalizar compra</Button>
      </CardFooter>
    </Card>

  </div>

  <Dialog v-model:open="checkoutOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Confirmar compra</DialogTitle>
        <DialogDescription>O valor será debitado da sua carteira virtual.</DialogDescription>
      </DialogHeader>
      <ul class="max-h-64 divide-y overflow-y-auto">
        <li v-for="item in cart" :key="item.product.id" class="flex justify-between gap-4 py-2 text-sm">
          <span class="min-w-0 truncate">{{ item.quantity }}× {{ item.product.name }}</span>
          <span class="tabular-nums">{{ formatCurrency(item.product.price * item.quantity) }}</span>
        </li>
      </ul>
      <dl class="grid gap-1.5 rounded-lg bg-muted p-3 text-sm">
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Saldo atual</dt>
          <dd class="tabular-nums">{{ formatCurrency(user?.balance ?? 0) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-muted-foreground">Total da compra</dt>
          <dd class="tabular-nums">− {{ formatCurrency(total) }}</dd>
        </div>
        <div class="flex justify-between border-t pt-1.5 font-semibold">
          <dt>Saldo após a compra</dt>
          <dd class="tabular-nums" :class="{ 'text-destructive': balanceAfter < 0 }">{{ formatCurrency(balanceAfter) }}</dd>
        </div>
      </dl>
      <p v-if="balanceAfter < 0" class="flex items-start gap-1.5 text-sm text-destructive">
        <TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
        Seu saldo ficará negativo. Faça uma recarga assim que possível.
      </p>
      <p v-if="checkoutError" role="alert" class="text-sm text-destructive">{{ checkoutError }}</p>
      <DialogFooter>
        <Button variant="outline" @click="checkoutOpen = false">Voltar</Button>
        <Button :disabled="submitting || cart.length === 0" @click="confirmPurchase">
          {{ submitting ? "Finalizando..." : `Pagar ${formatCurrency(total)}` }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
