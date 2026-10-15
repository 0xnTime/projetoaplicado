import type { ApiResult } from "@cantina/types";
import { signOut, token } from "./session";

type QueryValue = string | number | boolean | null | undefined;

export function withQuery(path: string, params: Record<string, QueryValue>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; file?: Blob } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.file) {
    headers["content-type"] = options.file.type;
    body = options.file;
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (token.value) headers.authorization = `Bearer ${token.value}`;

  try {
    const res = await fetch(`/api${path}`, { method: options.method ?? "GET", headers, body });
    if (res.status === 401 && token.value) signOut();
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, error: "Não foi possível conectar ao servidor" };
  }
}
