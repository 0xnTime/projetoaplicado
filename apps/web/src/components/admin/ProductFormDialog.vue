<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { ImageUpIcon, XIcon } from "@lucide/vue";
import type { Product } from "@cantina/types";
import ProductThumb from "@/components/ProductThumb.vue";
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
import { api } from "@/lib/api";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const props = defineProps<{ product: Product | null; categories: string[] }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ saved: [product: Product] }>();

const form = ref({ name: "", category: "", price: "", stock: "" });
const photoFile = ref<File | null>(null);
const photoPreview = ref<string | null>(null);
const removePhoto = ref(false);
const error = ref<string | null>(null);
const submitting = ref(false);

const editing = computed(() => props.product !== null);
const currentPhoto = computed(() => photoPreview.value ?? (removePhoto.value ? null : (props.product?.photo ?? null)));

function setPreview(file: File | null) {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photoFile.value = file;
  photoPreview.value = file ? URL.createObjectURL(file) : null;
}

watch(open, (value) => {
  if (!value) return;
  const p = props.product;
  form.value = {
    name: p?.name ?? "",
    category: p?.category ?? "",
    price: p ? String(p.price) : "",
    stock: p ? String(p.stock) : "",
  };
  setPreview(null);
  removePhoto.value = false;
  error.value = null;
});

onBeforeUnmount(() => setPreview(null));

function onPhotoChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = "";
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_PHOTO_BYTES) {
    error.value = "Envie uma imagem JPEG, PNG ou WebP de até 5 MB";
    return;
  }
  error.value = null;
  removePhoto.value = false;
  setPreview(file);
}

function clearPhoto() {
  setPreview(null);
  removePhoto.value = true;
}

async function submit() {
  error.value = null;
  const price = Number(String(form.value.price).replace(",", "."));
  const stock = Number(form.value.stock);
  if (!Number.isFinite(price) || price < 0) {
    error.value = "Informe um preço válido";
    return;
  }
  if (!Number.isInteger(stock) || stock < 0) {
    error.value = "O estoque deve ser um número inteiro maior ou igual a zero";
    return;
  }

  const body = {
    name: form.value.name.trim(),
    category: form.value.category.trim(),
    price: Math.round(price * 100) / 100,
    stock,
  };

  submitting.value = true;
  const result = props.product
    ? await api<Product>(`/produtos/${props.product.id}`, { method: "PATCH", body })
    : await api<Product>("/produtos", { method: "POST", body });
  if (!result.success) {
    submitting.value = false;
    error.value = result.error;
    return;
  }

  let saved = result.data;
  if (photoFile.value) {
    const upload = await api<Product>(`/produtos/${saved.id}/foto`, { method: "PUT", file: photoFile.value });
    if (upload.success) saved = upload.data;
    else toast.error("Produto salvo, mas a foto não foi enviada", { description: upload.error });
  } else if (removePhoto.value && saved.photo) {
    const removal = await api<Product>(`/produtos/${saved.id}/foto`, { method: "DELETE" });
    if (removal.success) saved = removal.data;
    else toast.error("Produto salvo, mas a foto não foi removida", { description: removal.error });
  }

  submitting.value = false;
  open.value = false;
  toast.success(editing.value ? "Produto atualizado" : "Produto cadastrado", { description: saved.name });
  emit("saved", saved);
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editing ? "Editar produto" : "Novo produto" }}</DialogTitle>
        <DialogDescription>
          {{ editing ? "Atualize os dados do produto." : "Cadastre um produto disponível na cantina." }}
        </DialogDescription>
      </DialogHeader>

      <form id="product-form" class="grid gap-4" @submit.prevent="submit">
        <div class="flex items-center gap-4">
          <ProductThumb :photo="currentPhoto" :name="form.name" class="size-20" />
          <div class="flex flex-wrap gap-2">
            <Button as="label" variant="outline" size="sm" class="cursor-pointer">
              <ImageUpIcon />
              {{ currentPhoto ? "Trocar foto" : "Enviar foto" }}
              <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" @change="onPhotoChange" />
            </Button>
            <Button v-if="currentPhoto" type="button" variant="ghost" size="sm" @click="clearPhoto">
              <XIcon /> Remover
            </Button>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="product-name">Nome</Label>
          <Input id="product-name" v-model="form.name" maxlength="120" required />
        </div>
        <div class="grid gap-2">
          <Label for="product-category">Categoria</Label>
          <Input id="product-category" v-model="form.category" list="product-categories" maxlength="60" required />
          <datalist id="product-categories">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label for="product-price">Preço (R$)</Label>
            <Input id="product-price" v-model="form.price" inputmode="decimal" placeholder="0,00" required />
          </div>
          <div class="grid gap-2">
            <Label for="product-stock">Estoque</Label>
            <Input id="product-stock" v-model="form.stock" type="number" min="0" step="1" required />
          </div>
        </div>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancelar</Button>
        <Button type="submit" form="product-form" :disabled="submitting">
          {{ submitting ? "Salvando..." : "Salvar" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
