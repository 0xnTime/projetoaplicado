import { buildApp } from "./app";
import { env } from "./config/env";

const app = buildApp();

await app.listen({ host: "0.0.0.0", port: env.PORT });
