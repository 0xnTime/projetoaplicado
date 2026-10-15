import type { ApiResult } from "@cantina/types";
import { signOut, token } from "./session";

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (token.value) headers.authorization = `Bearer ${token.value}`;

  try {
    const res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 401 && token.value) signOut();
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, error: "Não foi possível conectar ao servidor" };
  }
}
