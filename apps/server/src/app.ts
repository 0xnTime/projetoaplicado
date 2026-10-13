import Fastify from "fastify";
import { helloRoutes } from "./routes/hello";

export function buildApp() {
  const app = Fastify({ logger: true });
  app.register(helloRoutes);
  return app;
}
