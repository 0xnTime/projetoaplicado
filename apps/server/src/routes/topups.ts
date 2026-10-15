import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, PaymentMethod, Topup } from "@cantina/types";
import { authenticated, isAdmin } from "../lib/auth";
import { HttpError, idParams, periodFilter, periodQuery } from "../lib/http";

interface TopupRow {
  id_recarga: number;
  id_usuario: number;
  valor: string;
  forma_pagamento: PaymentMethod;
  data_hora: Date;
}

function toTopup(row: TopupRow): Topup {
  return {
    id: row.id_recarga,
    userId: row.id_usuario,
    amount: Number(row.valor),
    paymentMethod: row.forma_pagamento,
    createdAt: row.data_hora.toISOString(),
  };
}

const listQuery = periodQuery.extend({
  userId: z.coerce.number().int().positive().optional(),
});

const createBody = z.object({
  amount: z.number().positive().max(10000).multipleOf(0.01),
  paymentMethod: z.enum(["CREDITO", "DEBITO", "PIX"]),
});

export async function topupRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticated());

  app.get("/api/recargas", async (req): Promise<ApiResult<Topup[]>> => {
    const { from, to, ...query } = listQuery.parse(req.query);
    const userId = isAdmin(req) ? query.userId : req.session.id;
    const rows = await sql<TopupRow[]>`
      SELECT * FROM recarga
      WHERE TRUE
        ${userId ? sql`AND id_usuario = ${userId}` : sql``}
        ${periodFilter(sql`data_hora`, from, to)}
      ORDER BY data_hora DESC
    `;
    return { success: true, data: rows.map(toTopup) };
  });

  app.get("/api/recargas/:id", async (req): Promise<ApiResult<Topup>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<TopupRow[]>`SELECT * FROM recarga WHERE id_recarga = ${id}`;
    if (!row || (!isAdmin(req) && row.id_usuario !== req.session.id)) {
      throw new HttpError(404, "Recarga não encontrada");
    }
    return { success: true, data: toTopup(row) };
  });

  app.post("/api/recargas", async (req, reply): Promise<ApiResult<Topup>> => {
    const body = createBody.parse(req.body);
    const userId = req.session.id;
    const topup = await sql.begin(async (tx) => {
      const [user] = await tx<{ ativo: boolean }[]>`
        UPDATE usuario SET saldo = saldo + ${body.amount}
        WHERE id_usuario = ${userId}
        RETURNING ativo
      `;
      if (!user) throw new HttpError(404, "Usuário não encontrado");
      if (!user.ativo) throw new HttpError(422, "Usuário inativo");
      const [row] = await tx<TopupRow[]>`
        INSERT INTO recarga (id_usuario, valor, forma_pagamento)
        VALUES (${userId}, ${body.amount}, ${body.paymentMethod})
        RETURNING *
      `;
      return row!;
    });
    return reply.code(201).send({ success: true, data: toTopup(topup) });
  });
}
