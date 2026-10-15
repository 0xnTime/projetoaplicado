import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../config/env";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const URL_PREFIX = "/api/uploads/";
const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const photoMimeTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
type PhotoExtension = keyof typeof photoMimeTypes;

await mkdir(env.UPLOAD_DIR, { recursive: true });

// sem bypass aqui
function detectExtension(bytes: Buffer): PhotoExtension | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function savePhoto(bytes: Buffer): Promise<string | null> {
  const extension = detectExtension(bytes);
  if (!extension) return null;
  const name = `${crypto.randomUUID()}.${extension}`;
  await Bun.write(join(env.UPLOAD_DIR, name), bytes);
  return URL_PREFIX + name;
}

export async function removePhoto(url: string | null) {
  if (!url?.startsWith(URL_PREFIX)) return;
  const name = url.slice(URL_PREFIX.length);
  if (FILE_NAME.test(name)) await unlink(join(env.UPLOAD_DIR, name)).catch(() => {});
}

export function photoFile(name: string) {
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  return { file: Bun.file(join(env.UPLOAD_DIR, name)), type: photoMimeTypes[match[1] as PhotoExtension] };
}
