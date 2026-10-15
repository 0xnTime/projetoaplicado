<script setup lang="ts">
import { computed } from "vue";
import {
  BarChart3Icon,
  HistoryIcon,
  HouseIcon,
  LogOutIcon,
  PackageIcon,
  ShoppingBasketIcon,
  StoreIcon,
  UsersIcon,
  WalletIcon,
} from "@lucide/vue";
import { formatCurrency } from "@cantina/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabels } from "@/lib/labels";
import { signOut, user } from "@/lib/session";

const consumerLinks = [
  { name: "home", label: "Início", icon: HouseIcon },
  { name: "purchase", label: "Comprar", icon: ShoppingBasketIcon },
  { name: "wallet", label: "Carteira", icon: WalletIcon },
  { name: "history", label: "Histórico", icon: HistoryIcon },
];

const adminLinks = [
  { name: "admin-reports", label: "Relatórios", icon: BarChart3Icon },
  { name: "admin-products", label: "Produtos", icon: PackageIcon },
  { name: "admin-users", label: "Usuários", icon: UsersIcon },
];

const isAdmin = computed(() => user.value?.role === "ADMINISTRADOR");
const links = computed(() => (isAdmin.value ? adminLinks : consumerLinks));
const initials = computed(() =>
  (user.value?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join(""),
);
</script>

<template>
  <div v-if="user" class="min-h-svh bg-muted/40">
    <header class="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <RouterLink :to="isAdmin ? { name: 'admin-reports' } : { name: 'home' }" class="flex items-center gap-2 font-semibold">
          <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <StoreIcon class="size-4" />
          </span>
          <span class="hidden sm:inline">Cantina da Honestidade</span>
        </RouterLink>

        <nav class="hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="link in links"
            :key="link.name"
            :to="{ name: link.name }"
            class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            exact-active-class="bg-muted text-foreground font-medium"
          >
            <component :is="link.icon" class="size-4" />
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <RouterLink
            v-if="!isAdmin"
            :to="{ name: 'wallet' }"
            class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors hover:bg-muted"
            :class="user.balance < 0 ? 'border-destructive/40 text-destructive' : ''"
            title="Saldo da carteira"
          >
            <WalletIcon class="size-4" />
            <span class="font-semibold">{{ formatCurrency(user.balance) }}</span>
          </RouterLink>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="rounded-full" aria-label="Menu da conta">
                <span class="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  {{ initials }}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuLabel class="flex flex-col gap-0.5">
                <span class="truncate">{{ user.name }}</span>
                <span class="truncate text-xs font-normal text-muted-foreground">{{ user.email }}</span>
                <span class="text-xs font-normal text-muted-foreground">{{ roleLabels[user.role] }}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" @select="signOut">
                <LogOutIcon />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 pt-6 pb-24 md:pb-10">
      <RouterView />
    </main>

    <nav class="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
      <div class="mx-auto flex max-w-md">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
          exact-active-class="text-foreground font-medium"
        >
          <component :is="link.icon" class="size-5" />
          {{ link.label }}
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
