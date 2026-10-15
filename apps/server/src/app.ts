import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { SQL } from "bun";
import { ZodError } from "zod";
import type { ApiError } from "@cantina/types";
import { env } from "./config/env";
import { authRoutes } from "./routes/auth";
import { productRoutes } from "./routes/products";
import { userRoutes } from "./routes/users";
import { topupRoutes } from "./routes/topups";
import { purchaseRoutes } from "./routes/purchases";
import { reportRoutes } from "./routes/reports";
import { uploadRoutes } from "./routes/uploads";

const UNIQUE_VIOLATION = "23505";

const duplicateMessages: Record<string, string> = {
  usuario_email_key: "Este e-mail já está cadastrado",
};

const fastifyMessages: Record<string, string> = {
  FST_ERR_CTP_BODY_TOO_LARGE: "Conteúdo da requisição muito grande",
  FST_ERR_CTP_INVALID_MEDIA_TYPE: "Tipo de conteúdo não suportado",
};

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const error = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return reply.code(400).send({ success: false, error } satisfies ApiError);
    }
    if (err instanceof SQL.PostgresError && err.errno === UNIQUE_VIOLATION) {
      return reply.code(409).send({ success: false, error: duplicateMessages[err.constraint ?? ""] ?? "Registro duplicado" } satisfies ApiError);
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    const code = (err as { code?: string }).code ?? "";
    const error = status >= 500 ? "Erro interno do servidor" : (fastifyMessages[code] ?? (err as Error).message);
    return reply.code(status).send({ success: false, error } satisfies ApiError);
  });

  app.register(fastifyCors, { origin: env.CORS_ORIGIN });
  app.register(fastifyJwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
  app.decorateRequest("session", null as never);

  app.register(authRoutes);
  app.register(productRoutes);
  app.register(userRoutes);
  app.register(topupRoutes);
  app.register(purchaseRoutes);
  app.register(reportRoutes);
  app.register(uploadRoutes);
  return app;
}
