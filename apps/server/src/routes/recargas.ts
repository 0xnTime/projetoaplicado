import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, FormaPagamento, Recarga } from "@cantina/types";
import { autenticado, isAdmin } from "../lib/auth";
import { HttpError, idParams, periodoFilter, periodoQuery } from "../lib/http";

interface RecargaRow {
  id_recarga: number;
  id_usuario: number;
  valor: string;
  forma_pagamento: FormaPagamento;
  data_hora: Date;
}

function toRecarga(row: RecargaRow): Recarga {
  return {
    idRecarga: row.id_recarga,
    idUsuario: row.id_usuario,
    valor: Number(row.valor),
    formaPagamento: row.forma_pagamento,
    dataHora: row.data_hora.toISOString(),
  };
}

const listQuery = periodoQuery.extend({
  idUsuario: z.coerce.number().int().positive().optional(),
});

const createBody = z.object({
  valor: z.number().positive().max(10000).multipleOf(0.01),
  formaPagamento: z.enum(["CREDITO", "DEBITO", "PIX"]),
});

export async function recargaRoutes(app: FastifyInstance) {
  app.addHook("onRequest", autenticado());

  app.get("/api/recargas", async (req): Promise<ApiResult<Recarga[]>> => {
    const { de, ate, ...query } = listQuery.parse(req.query);
    const idUsuario = isAdmin(req) ? query.idUsuario : req.sessao.id;
    const rows = await sql<RecargaRow[]>`
      SELECT * FROM recarga
      WHERE TRUE
        ${idUsuario ? sql`AND id_usuario = ${idUsuario}` : sql``}
        ${periodoFilter(sql`data_hora`, de, ate)}
      ORDER BY data_hora DESC
    `;
    return { success: true, data: rows.map(toRecarga) };
  });

  app.get("/api/recargas/:id", async (req): Promise<ApiResult<Recarga>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<RecargaRow[]>`SELECT * FROM recarga WHERE id_recarga = ${id}`;
    if (!row || (!isAdmin(req) && row.id_usuario !== req.sessao.id)) {
      throw new HttpError(404, "Recarga não encontrada");
    }
    return { success: true, data: toRecarga(row) };
  });

  app.post("/api/recargas", async (req, reply): Promise<ApiResult<Recarga>> => {
    const body = createBody.parse(req.body);
    const idUsuario = req.sessao.id;
    const recarga = await sql.begin(async (tx) => {
      const [usuario] = await tx<{ ativo: boolean }[]>`
        UPDATE usuario SET saldo = saldo + ${body.valor}
        WHERE id_usuario = ${idUsuario}
        RETURNING ativo
      `;
      if (!usuario) throw new HttpError(404, "Usuário não encontrado");
      if (!usuario.ativo) throw new HttpError(422, "Usuário inativo");
      const [row] = await tx<RecargaRow[]>`
        INSERT INTO recarga (id_usuario, valor, forma_pagamento)
        VALUES (${idUsuario}, ${body.valor}, ${body.formaPagamento})
        RETURNING *
      `;
      return row!;
    });
    return reply.code(201).send({ success: true, data: toRecarga(recarga) });
  });
}
