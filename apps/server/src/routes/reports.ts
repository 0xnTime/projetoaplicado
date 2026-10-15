import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, ConsumptionReport, ProductSales, SalesReport } from "@cantina/types";
import { adminOnly } from "../lib/auth";
import { HttpError, idParams, periodFilter, periodQuery, TIMEZONE } from "../lib/http";

const periodFormats = { day: "YYYY-MM-DD", month: "YYYY-MM", year: "YYYY" };

const salesQuery = periodQuery.extend({
  groupBy: z.enum(["day", "month", "year"]).default("day"),
});

const topProductsQuery = periodQuery.extend({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

interface ProductSalesRow {
  id_produto: number;
  nome: string;
  categoria: string;
  quantity: number;
  revenue: string;
}

function toProductSales(row: ProductSalesRow): ProductSales {
  return {
    productId: row.id_produto,
    name: row.nome,
    category: row.categoria,
    quantity: row.quantity,
    revenue: Number(row.revenue),
  };
}

function selectProductSales(filter: { from?: string; to?: string; userId?: number; limit?: number }) {
  return sql<ProductSalesRow[]>`
    SELECT p.id_produto, p.nome, p.categoria,
           SUM(i.quantidade)::int AS quantity,
           SUM(i.quantidade * i.valor_unitario) AS revenue
    FROM item_compra i
    JOIN compra c ON c.id_compra = i.id_compra
    JOIN produto p ON p.id_produto = i.id_produto
    WHERE TRUE
      ${filter.userId ? sql`AND c.id_usuario = ${filter.userId}` : sql``}
      ${periodFilter(sql`c.data_hora`, filter.from, filter.to)}
    GROUP BY p.id_produto
    ORDER BY quantity DESC, revenue DESC, p.nome
    ${filter.limit ? sql`LIMIT ${filter.limit}` : sql``}
  `;
}

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("onRequest", adminOnly);

  app.get("/api/relatorios/vendas", async (req): Promise<ApiResult<SalesReport>> => {
    const { from, to, groupBy } = salesQuery.parse(req.query);
    const rows = await sql<{ period: string; revenue: string; sales_count: number }[]>`
      SELECT to_char(date_trunc(${groupBy}, data_hora AT TIME ZONE ${TIMEZONE}), ${periodFormats[groupBy]}) AS period,
             SUM(valor_total) AS revenue,
             COUNT(*)::int AS sales_count
      FROM compra
      WHERE TRUE ${periodFilter(sql`data_hora`, from, to)}
      GROUP BY period
      ORDER BY period
    `;
    const periods = rows.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue),
      salesCount: r.sales_count,
    }));
    const revenueCents = periods.reduce((sum, p) => sum + Math.round(p.revenue * 100), 0);
    return {
      success: true,
      data: {
        revenue: revenueCents / 100,
        salesCount: periods.reduce((sum, p) => sum + p.salesCount, 0),
        periods,
      },
    };
  });

  app.get("/api/relatorios/produtos-mais-vendidos", async (req): Promise<ApiResult<ProductSales[]>> => {
    const query = topProductsQuery.parse(req.query);
    const rows = await selectProductSales(query);
    return { success: true, data: rows.map(toProductSales) };
  });

  app.get("/api/relatorios/consumo/:id", async (req): Promise<ApiResult<ConsumptionReport>> => {
    const { id } = idParams.parse(req.params);
    const { from, to } = periodQuery.parse(req.query);
    const [user] = await sql<{ id_usuario: number; nome: string; email: string }[]>`
      SELECT id_usuario, nome, email FROM usuario WHERE id_usuario = ${id}
    `;
    if (!user) throw new HttpError(404, "Usuário não encontrado");

    const [[totals], products] = await Promise.all([
      sql<{ total: string; purchase_count: number }[]>`
        SELECT COALESCE(SUM(valor_total), 0) AS total, COUNT(*)::int AS purchase_count
        FROM compra
        WHERE id_usuario = ${id} ${periodFilter(sql`data_hora`, from, to)}
      `,
      selectProductSales({ from, to, userId: id }),
    ]);
    return {
      success: true,
      data: {
        user: { id: user.id_usuario, name: user.nome, email: user.email },
        total: Number(totals!.total),
        purchaseCount: totals!.purchase_count,
        products: products.map(toProductSales),
      },
    };
  });
}
