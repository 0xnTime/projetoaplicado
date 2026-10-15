import { ref } from "vue";
import type { LoginResponse, User } from "@cantina/types";
import { api } from "./api";

const STORAGE_KEY = "cantina.token";

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const token = ref<string | null>(readToken());
export const user = ref<User | null>(null);

export function signIn(session: LoginResponse) {
  token.value = session.token;
  user.value = session.user;
  try {
    localStorage.setItem(STORAGE_KEY, session.token);
  } catch {}
}

export function signOut() {
  token.value = null;
  user.value = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export async function refreshUser() {
  if (!token.value) return;
  const result = await api<User>("/auth/me");
  if (result.success) user.value = result.data;
}
