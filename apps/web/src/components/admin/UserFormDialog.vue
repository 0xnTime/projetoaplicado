<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import type { Role, User } from "@cantina/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { roleLabels } from "@/lib/labels";
import { user as currentUser } from "@/lib/session";

const props = defineProps<{ user: User | null; mode: "data" | "password" }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ saved: [user: User] }>();

const form = ref({ name: "", email: "", role: "CONSUMIDOR" as Role, password: "", confirmation: "" });
const error = ref<string | null>(null);
const submitting = ref(false);

const creating = computed(() => props.user === null);
const ownAccount = computed(() => props.user?.id === currentUser.value?.id);
const showPassword = computed(() => creating.value || props.mode === "password");

const title = computed(() =>
  props.mode === "password" ? "Redefinir senha" : creating.value ? "Novo usuário" : "Editar usuário",
);
const description = computed(() =>
  props.mode === "password"
    ? `Defina uma nova senha para ${props.user?.name}. Informe a senha ao usuário.`
    : creating.value
      ? "Cadastre um consumidor ou administrador."
      : "Atualize os dados cadastrais do usuário.",
);

watch(open, (value) => {
  if (!value) return;
  form.value = {
    name: props.user?.name ?? "",
    email: props.user?.email ?? "",
    role: props.user?.role ?? "CONSUMIDOR",
    password: "",
    confirmation: "",
  };
  error.value = null;
});

async function submit() {
  error.value = null;
  if (showPassword.value && form.value.password !== form.value.confirmation) {
    error.value = "As senhas não conferem";
    return;
  }

  const body =
    props.mode === "password"
      ? { password: form.value.password }
      : {
          name: form.value.name,
          email: form.value.email,
          ...(ownAccount.value ? {} : { role: form.value.role }),
          ...(creating.value ? { password: form.value.password } : {}),
        };

  submitting.value = true;
  const result = props.user
    ? await api<User>(`/usuarios/${props.user.id}`, { method: "PATCH", body })
    : await api<User>("/usuarios", { method: "POST", body });
  submitting.value = false;
  if (!result.success) {
    error.value = result.error;
    return;
  }
  open.value = false;
  toast.success(
    props.mode === "password" ? "Senha redefinida" : creating.value ? "Usuário cadastrado" : "Usuário atualizado",
    { description: result.data.name },
  );
  emit("saved", result.data);
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <form id="user-form" class="grid gap-4" @submit.prevent="submit">
        <template v-if="mode === 'data'">
          <div class="grid gap-2">
            <Label for="user-name">Nome</Label>
            <Input id="user-name" v-model="form.name" maxlength="120" autocomplete="off" required />
          </div>
          <div class="grid gap-2">
            <Label for="user-email">E-mail</Label>
            <Input id="user-email" v-model="form.email" type="email" maxlength="160" autocomplete="off" required />
          </div>
          <div class="grid gap-2">
            <Label for="user-role">Perfil</Label>
            <Select v-model="form.role" :disabled="ownAccount">
              <SelectTrigger id="user-role" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in roleLabels" :key="value" :value="value">{{ label }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="ownAccount" class="text-xs text-muted-foreground">Você não pode alterar o perfil da própria conta.</p>
          </div>
        </template>
        <template v-if="showPassword">
          <div class="grid gap-2">
            <Label for="user-password">{{ mode === "password" ? "Nova senha" : "Senha" }}</Label>
            <Input
              id="user-password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              minlength="8"
              maxlength="72"
              required
            />
            <p class="text-xs text-muted-foreground">Mínimo de 8 caracteres</p>
          </div>
          <div class="grid gap-2">
            <Label for="user-confirmation">Confirmar senha</Label>
            <Input
              id="user-confirmation"
              v-model="form.confirmation"
              type="password"
              autocomplete="new-password"
              minlength="8"
              maxlength="72"
              required
            />
          </div>
        </template>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancelar</Button>
        <Button type="submit" form="user-form" :disabled="submitting">
          {{ submitting ? "Salvando..." : "Salvar" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
