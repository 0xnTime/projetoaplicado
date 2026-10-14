import { sql, type SQL } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, Compra, ItemCompra } from "@cantina/types";
import { autenticado, isAdmin } from "../lib/auth";
import { HttpError, idParams, periodoFilter, periodoQuery } from "../lib/http";

interface CompraRow {
  id_compra: number;
  id_usuario: number;
  valor_total: string;
  data_hora: Date;
  itens: ItemCompra[];
}

function toCompra(row: CompraRow): Compra {
  return {
    idCompra: row.id_compra,
    idUsuario: row.id_usuario,
    valorTotal: Number(row.valor_total),
    dataHora: row.data_hora.toISOString(),
    itens: row.itens,
  };
}

function selectCompras(db: SQL, filter: SQL.Query<unknown>) {
  return db<CompraRow[]>`
    SELECT c.*, json_agg(json_build_object(
             'idProduto', i.id_produto,
             'nome', p.nome,
             'quantidade', i.quantidade,
             'valorUnitario', i.valor_unitario
           ) ORDER BY p.nome) AS itens
    FROM compra c
    JOIN item_compra i ON i.id_compra = c.id_compra
    JOIN produto p ON p.id_produto = i.id_produto
    WHERE TRUE ${filter}
    GROUP BY c.id_compra
    ORDER BY c.data_hora DESC
  `;
}

const listQuery = periodoQuery.extend({
  idUsuario: z.coerce.number().int().positive().optional(),
});

const createBody = z.object({
  itens: z
    .array(
      z.object({
        idProduto: z.number().int().positive(),
        quantidade: z.number().int().positive(),
      }),
    )
    .min(1),
});

interface ProdutoLock {
  id_produto: number;
  nome: string;
  preco: string;
  estoque: number;
  ativo: boolean;
}

export async function compraRoutes(app: FastifyInstance) {
  app.addHook("onRequest", autenticado());

  app.get("/api/compras", async (req): Promise<ApiResult<Compra[]>> => {
    const { de, ate, ...query } = listQuery.parse(req.query);
    const idUsuario = isAdmin(req) ? query.idUsuario : req.sessao.id;
    const rows = await selectCompras(
      sql,
      sql`
        ${idUsuario ? sql`AND c.id_usuario = ${idUsuario}` : sql``}
        ${periodoFilter(sql`c.data_hora`, de, ate)}
      `,
    );
    return { success: true, data: rows.map(toCompra) };
  });

  app.get("/api/compras/:id", async (req): Promise<ApiResult<Compra>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await selectCompras(sql, sql`AND c.id_compra = ${id}`);
    if (!row || (!isAdmin(req) && row.id_usuario !== req.sessao.id)) {
      throw new HttpError(404, "Compra não encontrada");
    }
    return { success: true, data: toCompra(row) };
  });

  app.post("/api/compras", async (req, reply): Promise<ApiResult<Compra>> => {
    const body = createBody.parse(req.body);
    const idUsuario = req.sessao.id;

    const quantidades = new Map<number, number>();
    for (const item of body.itens) {
      quantidades.set(item.idProduto, (quantidades.get(item.idProduto) ?? 0) + item.quantidade);
    }
    const ids = [...quantidades.keys()];

    const compra = await sql.begin(async (tx) => {
      const [usuario] = await tx<{ ativo: boolean }[]>`
        SELECT ativo FROM usuario WHERE id_usuario = ${idUsuario} FOR UPDATE
      `;
      if (!usuario) throw new HttpError(404, "Usuário não encontrado");
      if (!usuario.ativo) throw new HttpError(422, "Usuário inativo");

      const produtos = await tx<ProdutoLock[]>`
        SELECT id_produto, nome, preco, estoque, ativo FROM produto
        WHERE id_produto IN ${tx(ids)}
        ORDER BY id_produto
        FOR UPDATE
      `;
      const porId = new Map(produtos.map((p) => [p.id_produto, p]));

      let totalCentavos = 0;
      const itens = ids.map((id) => {
        const produto = porId.get(id);
        const quantidade = quantidades.get(id)!;
        if (!produto || !produto.ativo) {
          throw new HttpError(422, `Produto ${id} não encontrado ou inativo`);
        }
        if (produto.estoque < quantidade) {
          throw new HttpError(422, `Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoque})`);
        }
        totalCentavos += Math.round(Number(produto.preco) * 100) * quantidade;
        return { id_produto: id, quantidade, valor_unitario: produto.preco };
      });

      const total = totalCentavos / 100;

      await tx`UPDATE usuario SET saldo = saldo - ${total} WHERE id_usuario = ${idUsuario}`;
      const [{ id_compra }] = (await tx<{ id_compra: number }[]>`
        INSERT INTO compra (id_usuario, valor_total)
        VALUES (${idUsuario}, ${total})
        RETURNING id_compra
      `) as [{ id_compra: number }];
      await tx`
        INSERT INTO item_compra ${tx(itens.map((i) => ({ id_compra, ...i })))}
      `;
      for (const item of itens) {
        await tx`
          UPDATE produto SET estoque = estoque - ${item.quantidade}
          WHERE id_produto = ${item.id_produto}
        `;
      }

      const [row] = await selectCompras(tx, tx`AND c.id_compra = ${id_compra}`);
      return row!;
    });

    return reply.code(201).send({ success: true, data: toCompra(compra) });
  });
}
