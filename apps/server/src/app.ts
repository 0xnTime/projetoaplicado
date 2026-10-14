import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import { SQL } from "bun";
import { ZodError } from "zod";
import type { ApiError } from "@cantina/types";
import { env } from "./config/env";
import { authRoutes } from "./routes/auth";
import { produtoRoutes } from "./routes/produtos";
import { usuarioRoutes } from "./routes/usuarios";
import { recargaRoutes } from "./routes/recargas";
import { compraRoutes } from "./routes/compras";

const UNIQUE_VIOLATION = "23505";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const error = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      return reply.code(400).send({ success: false, error } satisfies ApiError);
    }
    if (err instanceof SQL.PostgresError && err.errno === UNIQUE_VIOLATION) {
      return reply.code(409).send({ success: false, error: "Registro duplicado: " + err.detail } satisfies ApiError);
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    const error = status >= 500 ? "Erro interno do servidor" : (err as Error).message;
    return reply.code(status).send({ success: false, error } satisfies ApiError);
  });

  app.register(fastifyJwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
  app.decorateRequest("sessao", null as never);

  app.register(authRoutes);
  app.register(produtoRoutes);
  app.register(usuarioRoutes);
  app.register(recargaRoutes);
  app.register(compraRoutes);
  return app;
}
