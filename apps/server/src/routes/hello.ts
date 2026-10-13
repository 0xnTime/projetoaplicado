import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import type { ApiResult, Hello } from "@cantina/types";

export async function helloRoutes(app: FastifyInstance) {
  app.get("/api/hello", async (): Promise<ApiResult<Hello>> => {
    const [row] = await sql<{ now: Date }[]>`SELECT now() AS now`;
    return {
      success: true,
      data: {
        message: "hello from cantina",
        dbTime: (row?.now ?? new Date()).toISOString(),
      },
    };
  });
}
