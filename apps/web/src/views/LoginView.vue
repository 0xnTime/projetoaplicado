<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { LoginResponse } from "@cantina/types";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { signIn } from "@/lib/session";

type Mode = "login" | "signup" | "forgot" | "reset";

const texts: Record<Mode, { title: string; description: string; submit: string }> = {
  login: { title: "Entrar na sua conta", description: "Informe seu e-mail institucional e senha", submit: "Entrar" },
  signup: { title: "Criar conta", description: "Cadastre-se com seu e-mail institucional", submit: "Criar conta" },
  forgot: {
    title: "Esqueceu a senha?",
    description: "Informe seu e-mail e enviaremos um link para redefinir a senha",
    submit: "Enviar link",
  },
  reset: { title: "Redefinir senha", description: "Escolha uma nova senha para sua conta", submit: "Salvar nova senha" },
};

const resetToken = new URLSearchParams(location.search).get("redefinir");
if (resetToken) history.replaceState(null, "", location.pathname);

const mode = ref<Mode>(resetToken ? "reset" : "login");
const name = ref("");
const email = ref("");
const password = ref("");
const confirmation = ref("");
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const submitting = ref(false);

watch([name, email, password, confirmation], () => {
  error.value = null;
});

const text = computed(() => texts[mode.value]);
const newPassword = computed(() => mode.value === "signup" || mode.value === "reset");

function goTo(next: Mode) {
  mode.value = next;
  password.value = "";
  confirmation.value = "";
  error.value = null;
  notice.value = null;
}

async function submit() {
  error.value = null;
  notice.value = null;

  if (mode.value === "reset" && password.value !== confirmation.value) {
    error.value = "As senhas não conferem";
    return;
  }

  submitting.value = true;
  if (mode.value === "forgot") {
    const result = await api<null>("/auth/esqueci-senha", { method: "POST", body: { email: email.value } });
    submitting.value = false;
    if (result.success) notice.value = "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.";
    else error.value = result.error;
    return;
  }

  const result =
    mode.value === "signup"
      ? await api<LoginResponse>("/auth/cadastro", {
          method: "POST",
          body: { name: name.value, email: email.value, password: password.value },
        })
      : mode.value === "reset"
        ? await api<LoginResponse>("/auth/redefinir-senha", {
            method: "POST",
            body: { token: resetToken, password: password.value },
          })
        : await api<LoginResponse>("/auth/login", {
            method: "POST",
            body: { email: email.value, password: password.value },
          });
  submitting.value = false;
  if (result.success) signIn(result.data);
  else error.value = result.error;
}
</script>

<template>
  <main class="flex min-h-svh items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{{ text.title }}</CardTitle>
        <CardDescription>{{ text.description }}</CardDescription>
        <CardAction>
          <Button v-if="mode === 'login'" variant="link" @click="goTo('signup')">Criar conta</Button>
          <Button v-else variant="link" @click="goTo('login')">Entrar</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form id="auth-form" class="flex flex-col gap-6" @submit.prevent="submit">
          <div v-if="mode === 'signup'" class="grid gap-2">
            <Label for="name">Nome</Label>
            <Input id="name" v-model="name" autocomplete="name" placeholder="usuario" required />
          </div>
          <div v-if="mode !== 'reset'" class="grid gap-2">
            <Label for="email">E-mail</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" placeholder="exemplo@sc.senai.br" required />
          </div>
          <div v-if="mode !== 'forgot'" class="grid gap-2">
            <div class="flex items-center">
              <Label for="password">{{ mode === "reset" ? "Nova senha" : "Senha" }}</Label>
              <button
                v-if="mode === 'login'"
                type="button"
                class="ml-auto text-sm underline-offset-4 hover:underline"
                @click="goTo('forgot')"
              >
                Esqueceu a senha?
              </button>
            </div>
            <Input
              id="password"
              v-model="password"
              type="password"
              :autocomplete="newPassword ? 'new-password' : 'current-password'"
              :minlength="newPassword ? 8 : undefined"
              :aria-invalid="error ? true : undefined"
              required
            />
            <p v-if="newPassword" class="text-xs text-muted-foreground">Mínimo de 8 caracteres</p>
          </div>
          <div v-if="mode === 'reset'" class="grid gap-2">
            <Label for="confirmation">Confirmar nova senha</Label>
            <Input
              id="confirmation"
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              minlength="8"
              :aria-invalid="error ? true : undefined"
              required
            />
          </div>
          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
          <p v-if="notice" role="status" class="text-sm text-muted-foreground">{{ notice }}</p>
        </form>
      </CardContent>
      <CardFooter class="flex-col gap-2">
        <Button type="submit" form="auth-form" class="w-full" :disabled="submitting">
          {{ submitting ? "Aguarde..." : text.submit }}
        </Button>
      </CardFooter>
    </Card>
  </main>
</template>
