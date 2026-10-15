<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import { CreditCardIcon, QrCodeIcon, WalletCardsIcon } from "@lucide/vue";
import type { PaymentMethod, Topup } from "@cantina/types";
import { formatCurrency, formatDateTime } from "@cantina/utils";
import PageHeader from "@/components/PageHeader.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { paymentMethodLabels } from "@/lib/labels";
import { refreshUser, user } from "@/lib/session";

const presets = [10, 20, 50, 100];
const methods: { value: PaymentMethod; icon: typeof CreditCardIcon }[] = [
  { value: "PIX", icon: QrCodeIcon },
  { value: "CREDITO", icon: CreditCardIcon },
  { value: "DEBITO", icon: WalletCardsIcon },
];

const amount = ref<number | string>("");
const paymentMethod = ref<PaymentMethod>("PIX");
const error = ref<string | null>(null);
const submitting = ref(false);
const recent = ref<Topup[]>([]);

const parsedAmount = computed(() => {
  const value = Number(String(amount.value).replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
});
const valid = computed(() => parsedAmount.value > 0 && parsedAmount.value <= 10000);

async function loadRecent() {
  const result = await api<Topup[]>("/recargas");
  if (result.success) recent.value = result.data.slice(0, 5);
}

async function submit() {
  error.value = null;
  if (!valid.value) {
    error.value = "Informe um valor entre R$ 0,01 e R$ 10.000,00";
    return;
  }
  submitting.value = true;
  const result = await api<Topup>("/recargas", {
    method: "POST",
    body: { amount: parsedAmount.value, paymentMethod: paymentMethod.value },
  });
  submitting.value = false;
  if (!result.success) {
    error.value = result.error;
    return;
  }
  amount.value = "";
  await Promise.all([refreshUser(), loadRecent()]);
  toast.success("Recarga concluída", {
    description: `${formatCurrency(result.data.amount)} via ${paymentMethodLabels[result.data.paymentMethod]}. Saldo atual: ${formatCurrency(user.value?.balance ?? 0)}`,
  });
}

onMounted(() => {
  refreshUser();
  loadRecent();
});
</script>

<template>
  <PageHeader title="Carteira" description="Recarregue créditos para usar na cantina." />

  <div v-if="user" class="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
    <Card>
      <CardHeader>
        <CardTitle>Recarregar créditos</CardTitle>
        <CardDescription>Escolha o valor e a forma de pagamento.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="topup-form" class="grid gap-6" @submit.prevent="submit">
          <div class="grid gap-2">
            <Label for="amount">Valor</Label>
            <div class="relative">
              <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                id="amount"
                v-model="amount"
                inputmode="decimal"
                placeholder="0,00"
                autocomplete="off"
                class="h-11 pl-10 text-lg tabular-nums"
                :aria-invalid="error ? true : undefined"
                @input="error = null"
              />
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="preset in presets"
                :key="preset"
                type="button"
                size="sm"
                :variant="parsedAmount === preset ? 'default' : 'outline'"
                @click="amount = String(preset)"
              >
                {{ formatCurrency(preset) }}
              </Button>
            </div>
          </div>

          <fieldset class="grid gap-2">
            <legend class="mb-2 text-sm font-medium">Forma de pagamento</legend>
            <div class="grid gap-2 sm:grid-cols-3">
              <label
                v-for="method in methods"
                :key="method.value"
                class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted has-checked:border-foreground has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input v-model="paymentMethod" type="radio" name="paymentMethod" :value="method.value" class="sr-only" />
                <component :is="method.icon" class="size-5 text-muted-foreground" />
                {{ paymentMethodLabels[method.value] }}
              </label>
            </div>
          </fieldset>

          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="topup-form" size="lg" class="w-full sm:w-auto" :disabled="submitting">
          {{ submitting ? "Processando..." : valid ? `Recarregar ${formatCurrency(parsedAmount)}` : "Recarregar" }}
        </Button>
      </CardFooter>
    </Card>

    <div class="grid gap-6">
      <Card>
        <CardContent>
          <p class="text-sm text-muted-foreground">Saldo atual</p>
          <p class="mt-1 text-3xl font-semibold tabular-nums" :class="{ 'text-destructive': user.balance < 0 }">
            {{ formatCurrency(user.balance) }}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas recargas</CardTitle>
        </CardHeader>
        <CardContent>
          <p v-if="recent.length === 0" class="text-sm text-muted-foreground">Nenhuma recarga ainda.</p>
          <ul v-else class="divide-y">
            <li v-for="topup in recent" :key="topup.id" class="flex items-center justify-between gap-4 py-2.5 text-sm">
              <div>
                <p>{{ paymentMethodLabels[topup.paymentMethod] }}</p>
                <p class="text-xs text-muted-foreground">{{ formatDateTime(topup.createdAt) }}</p>
              </div>
              <span class="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
                + {{ formatCurrency(topup.amount) }}
              </span>
            </li>
          </ul>
          <Button as-child variant="link" class="mt-2 px-0">
            <RouterLink :to="{ name: 'history', query: { aba: 'recargas' } }">Ver extrato completo</RouterLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
