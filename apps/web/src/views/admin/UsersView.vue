<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import {
  BarChart3Icon,
  EllipsisIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  SearchIcon,
} from "@lucide/vue";
import type { User } from "@cantina/types";
import { formatCurrency } from "@cantina/utils";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import PageHeader from "@/components/PageHeader.vue";
import UserFormDialog from "@/components/admin/UserFormDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, withQuery } from "@/lib/api";
import { formatDate, roleLabels } from "@/lib/labels";
import { refreshUser, user as currentUser } from "@/lib/session";

const router = useRouter();

const users = ref<User[] | null>(null);
const search = ref("");
const role = ref<"CONSUMIDOR" | "ADMINISTRADOR" | "all">("CONSUMIDOR");
const status = ref<"true" | "false" | "all">("all");

const formOpen = ref(false);
const formMode = ref<"data" | "password">("data");
const selected = ref<User | null>(null);
const confirmOpen = ref(false);
const busy = ref(false);

let lastRequest = 0;

async function load() {
  const request = ++lastRequest;
  const result = await api<User[]>(
    withQuery("/usuarios", {
      search: search.value.trim(),
      role: role.value === "all" ? undefined : role.value,
      active: status.value === "all" ? undefined : status.value,
    }),
  );
  if (request !== lastRequest) return;
  if (!result.success) {
    toast.error(result.error);
    users.value = [];
    return;
  }
  users.value = result.data;
}

watch([role, status], load);
watchDebounced(search, load, { debounce: 300 });
load();

function openForm(user: User | null, mode: "data" | "password") {
  selected.value = user;
  formMode.value = mode;
  formOpen.value = true;
}

function onSaved(saved: User) {
  if (saved.id === currentUser.value?.id) refreshUser();
  load();
}

function askToggle(user: User) {
  selected.value = user;
  confirmOpen.value = true;
}

async function toggleActive() {
  const user = selected.value;
  if (!user) return;
  busy.value = true;
  const result = await api<User>(`/usuarios/${user.id}`, { method: "PATCH", body: { active: !user.active } });
  busy.value = false;
  confirmOpen.value = false;
  if (!result.success) return toast.error(result.error);
  toast.success(result.data.active ? "Usuário ativado" : "Usuário desativado", { description: result.data.name });
  load();
}
</script>

<template>
  <PageHeader title="Usuários" description="Gerencie os cadastros de consumidores e administradores.">
    <Button @click="openForm(null, 'data')"><PlusIcon /> Novo usuário</Button>
  </PageHeader>

  <Card>
    <CardContent class="grid gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-48 flex-1">
          <SearchIcon class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" placeholder="Buscar por nome ou e-mail" class="pl-8" aria-label="Buscar usuário" />
        </div>
        <Select v-model="role">
          <SelectTrigger class="w-40" aria-label="Perfil"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="CONSUMIDOR">Consumidores</SelectItem>
            <SelectItem value="ADMINISTRADOR">Administradores</SelectItem>
            <SelectItem value="all">Todos os perfis</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="status">
          <SelectTrigger class="w-36" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead class="hidden md:table-cell">Perfil</TableHead>
            <TableHead class="hidden sm:table-cell">Situação</TableHead>
            <TableHead class="hidden lg:table-cell">Cadastro</TableHead>
            <TableHead class="text-right">Saldo</TableHead>
            <TableHead class="w-10"><span class="sr-only">Ações</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="!users" :colspan="6">Carregando...</TableEmpty>
          <TableEmpty v-else-if="users.length === 0" :colspan="6">Nenhum usuário encontrado.</TableEmpty>
          <TableRow v-for="user in users" v-else :key="user.id">
            <TableCell>
              <p class="font-medium">
                {{ user.name }}
                <span v-if="user.id === currentUser?.id" class="text-xs font-normal text-muted-foreground">(você)</span>
              </p>
              <p class="text-xs text-muted-foreground">{{ user.email }}</p>
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <Badge :variant="user.role === 'ADMINISTRADOR' ? 'default' : 'secondary'">{{ roleLabels[user.role] }}</Badge>
            </TableCell>
            <TableCell class="hidden sm:table-cell">
              <Badge v-if="user.active" variant="outline">Ativo</Badge>
              <Badge v-else variant="destructive">Inativo</Badge>
            </TableCell>
            <TableCell class="hidden lg:table-cell">{{ formatDate(user.createdAt) }}</TableCell>
            <TableCell class="text-right tabular-nums" :class="{ 'text-destructive': user.balance < 0 }">
              {{ formatCurrency(user.balance) }}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm" :aria-label="`Ações para ${user.name}`">
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="openForm(user, 'data')"><PencilIcon /> Editar dados</DropdownMenuItem>
                  <DropdownMenuItem @select="openForm(user, 'password')"><KeyRoundIcon /> Redefinir senha</DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="user.role === 'CONSUMIDOR'"
                    @select="router.push({ name: 'admin-reports', query: { aba: 'consumo', usuario: user.id } })"
                  >
                    <BarChart3Icon /> Ver consumo
                  </DropdownMenuItem>
                  <template v-if="user.id !== currentUser?.id">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem v-if="user.active" variant="destructive" @select="askToggle(user)">
                      <PowerOffIcon /> Desativar
                    </DropdownMenuItem>
                    <DropdownMenuItem v-else @select="askToggle(user)"><PowerIcon /> Ativar</DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>

  <UserFormDialog v-model:open="formOpen" :user="selected" :mode="formMode" @saved="onSaved" />

  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="selected?.active ? 'Desativar usuário?' : 'Ativar usuário?'"
    :description="
      selected?.active
        ? `${selected?.name} não poderá mais entrar no sistema até ser ativado novamente.`
        : `${selected?.name} poderá entrar no sistema novamente.`
    "
    :confirm-label="selected?.active ? 'Desativar' : 'Ativar'"
    :destructive="selected?.active"
    :busy="busy"
    @confirm="toggleActive"
  />
</template>
