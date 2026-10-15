import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../lib/http";
import { photoFile } from "../lib/uploads";

const fileParams = z.object({ name: z.string() });

// public so <img src> works without the Authorization header
export async function uploadRoutes(app: FastifyInstance) {
  app.get("/api/uploads/:name", async (req, reply) => {
    const { name } = fileParams.parse(req.params);
    const photo = photoFile(name);
    if (!photo || !(await photo.file.exists())) throw new HttpError(404, "Arquivo não encontrado");
    return reply
      .type(photo.type)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(Buffer.from(await photo.file.arrayBuffer()));
  });
}
