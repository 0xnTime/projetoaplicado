import { sql, type SQL } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, Purchase, PurchaseItem } from "@cantina/types";
import { authenticated, isAdmin } from "../lib/auth";
import { HttpError, idParams, periodFilter, periodQuery } from "../lib/http";

interface PurchaseRow {
  id_compra: number;
  id_usuario: number;
  valor_total: string;
  data_hora: Date;
  items: PurchaseItem[];
}

function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id_compra,
    userId: row.id_usuario,
    total: Number(row.valor_total),
    createdAt: row.data_hora.toISOString(),
    items: row.items,
  };
}

function selectPurchases(db: SQL, filter: SQL.Query<unknown>) {
  return db<PurchaseRow[]>`
    SELECT c.*, json_agg(json_build_object(
             'productId', i.id_produto,
             'name', p.nome,
             'quantity', i.quantidade,
             'unitPrice', i.valor_unitario
           ) ORDER BY p.nome) AS items
    FROM compra c
    JOIN item_compra i ON i.id_compra = c.id_compra
    JOIN produto p ON p.id_produto = i.id_produto
    WHERE TRUE ${filter}
    GROUP BY c.id_compra
    ORDER BY c.data_hora DESC
  `;
}

const listQuery = periodQuery.extend({
  userId: z.coerce.number().int().positive().optional(),
});

const createBody = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

interface LockedProduct {
  id_produto: number;
  nome: string;
  preco: string;
  estoque: number;
  ativo: boolean;
}

export async function purchaseRoutes(app: FastifyInstance) {
  app.addHook("onRequest", authenticated());

  app.get("/api/compras", async (req): Promise<ApiResult<Purchase[]>> => {
    const { from, to, ...query } = listQuery.parse(req.query);
    const userId = isAdmin(req) ? query.userId : req.session.id;
    const rows = await selectPurchases(
      sql,
      sql`
        ${userId ? sql`AND c.id_usuario = ${userId}` : sql``}
        ${periodFilter(sql`c.data_hora`, from, to)}
      `,
    );
    return { success: true, data: rows.map(toPurchase) };
  });

  app.get("/api/compras/:id", async (req): Promise<ApiResult<Purchase>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await selectPurchases(sql, sql`AND c.id_compra = ${id}`);
    if (!row || (!isAdmin(req) && row.id_usuario !== req.session.id)) {
      throw new HttpError(404, "Compra não encontrada");
    }
    return { success: true, data: toPurchase(row) };
  });

  app.post("/api/compras", async (req, reply): Promise<ApiResult<Purchase>> => {
    const body = createBody.parse(req.body);
    const userId = req.session.id;

    const quantities = new Map<number, number>();
    for (const item of body.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }
    const ids = [...quantities.keys()];

    const purchase = await sql.begin(async (tx) => {
      const [user] = await tx<{ ativo: boolean }[]>`
        SELECT ativo FROM usuario WHERE id_usuario = ${userId} FOR UPDATE
      `;
      if (!user) throw new HttpError(404, "Usuário não encontrado");
      if (!user.ativo) throw new HttpError(422, "Usuário inativo");

      const products = await tx<LockedProduct[]>`
        SELECT id_produto, nome, preco, estoque, ativo FROM produto
        WHERE id_produto IN ${tx(ids)}
        ORDER BY id_produto
        FOR UPDATE
      `;
      const byId = new Map(products.map((p) => [p.id_produto, p]));

      let totalCents = 0;
      const items = ids.map((id) => {
        const product = byId.get(id);
        const quantity = quantities.get(id)!;
        if (!product || !product.ativo) {
          throw new HttpError(422, `Produto ${id} não encontrado ou inativo`);
        }
        if (product.estoque < quantity) {
          throw new HttpError(422, `Estoque insuficiente para ${product.nome} (disponível: ${product.estoque})`);
        }
        totalCents += Math.round(Number(product.preco) * 100) * quantity;
        return { id_produto: id, quantidade: quantity, valor_unitario: product.preco };
      });

      const total = totalCents / 100;

      await tx`UPDATE usuario SET saldo = saldo - ${total} WHERE id_usuario = ${userId}`;
      const [{ id_compra }] = (await tx<{ id_compra: number }[]>`
        INSERT INTO compra (id_usuario, valor_total)
        VALUES (${userId}, ${total})
        RETURNING id_compra
      `) as [{ id_compra: number }];
      await tx`
        INSERT INTO item_compra ${tx(items.map((i) => ({ id_compra, ...i })))}
      `;
      for (const item of items) {
        await tx`
          UPDATE produto SET estoque = estoque - ${item.quantidade}
          WHERE id_produto = ${item.id_produto}
        `;
      }

      const [row] = await selectPurchases(tx, tx`AND c.id_compra = ${id_compra}`);
      return row!;
    });

    return reply.code(201).send({ success: true, data: toPurchase(purchase) });
  });
}
