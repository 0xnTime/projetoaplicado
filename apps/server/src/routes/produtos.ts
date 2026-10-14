import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, Produto } from "@cantina/types";
import { apenasAdmin, autenticado, isAdmin } from "../lib/auth";
import { HttpError, idParams } from "../lib/http";

interface ProdutoRow {
  id_produto: number;
  nome: string;
  categoria: string;
  preco: string;
  estoque: number;
  codigo_barras: string;
  foto: string | null;
  ativo: boolean;
}

function toProduto(row: ProdutoRow): Produto {
  return {
    idProduto: row.id_produto,
    nome: row.nome,
    categoria: row.categoria,
    preco: Number(row.preco),
    estoque: row.estoque,
    codigoBarras: row.codigo_barras,
    foto: row.foto,
    ativo: row.ativo,
  };
}

const listQuery = z.object({
  nome: z.string().trim().min(1).optional(),
  categoria: z.string().trim().min(1).optional(),
  ativo: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const createBody = z.object({
  nome: z.string().trim().min(1).max(120),
  categoria: z.string().trim().min(1).max(60),
  preco: z.number().nonnegative().multipleOf(0.01),
  estoque: z.number().int().nonnegative(),
  codigoBarras: z.string().trim().min(1).max(50),
  foto: z.string().trim().max(255).nullable().optional(),
});

const updateBody = createBody.partial().refine((b) => Object.keys(b).length > 0, {
  message: "Informe ao menos um campo para atualizar",
});

const notFound = () => new HttpError(404, "Produto não encontrado");

export async function produtoRoutes(app: FastifyInstance) {
  app.get("/api/produtos", { onRequest: autenticado() }, async (req): Promise<ApiResult<Produto[]>> => {
    const { nome, categoria, ...query } = listQuery.parse(req.query);
    const ativo = isAdmin(req) ? query.ativo : true;
    const rows = await sql<ProdutoRow[]>`
      SELECT * FROM produto
      WHERE TRUE
        ${nome ? sql`AND nome ILIKE ${"%" + nome + "%"}` : sql``}
        ${categoria ? sql`AND categoria ILIKE ${"%" + categoria + "%"}` : sql``}
        ${ativo !== undefined ? sql`AND ativo = ${ativo}` : sql``}
      ORDER BY nome
    `;
    return { success: true, data: rows.map(toProduto) };
  });

  app.get("/api/produtos/:id", { onRequest: autenticado() }, async (req): Promise<ApiResult<Produto>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<ProdutoRow[]>`SELECT * FROM produto WHERE id_produto = ${id}`;
    if (!row || (!row.ativo && !isAdmin(req))) throw notFound();
    return { success: true, data: toProduto(row) };
  });

  app.post("/api/produtos", { onRequest: apenasAdmin }, async (req, reply): Promise<ApiResult<Produto>> => {
    const body = createBody.parse(req.body);
    const [row] = await sql<ProdutoRow[]>`
      INSERT INTO produto (nome, categoria, preco, estoque, codigo_barras, foto)
      VALUES (${body.nome}, ${body.categoria}, ${body.preco}, ${body.estoque},
              ${body.codigoBarras}, ${body.foto ?? null})
      RETURNING *
    `;
    return reply.code(201).send({ success: true, data: toProduto(row!) });
  });

  app.patch("/api/produtos/:id", { onRequest: apenasAdmin }, async (req): Promise<ApiResult<Produto>> => {
    const { id } = idParams.parse(req.params);
    const body = updateBody.parse(req.body);
    const changes = {
      nome: body.nome,
      categoria: body.categoria,
      preco: body.preco,
      estoque: body.estoque,
      codigo_barras: body.codigoBarras,
      foto: body.foto,
    };
    const columns = (Object.keys(changes) as (keyof typeof changes)[]).filter(
      (k) => changes[k] !== undefined,
    );
    const [row] = await sql<ProdutoRow[]>`
      UPDATE produto SET ${sql(changes, ...columns)}
      WHERE id_produto = ${id}
      RETURNING *
    `;
    if (!row) throw notFound();
    return { success: true, data: toProduto(row) };
  });

  app.delete("/api/produtos/:id", { onRequest: apenasAdmin }, async (req): Promise<ApiResult<Produto>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<ProdutoRow[]>`
      UPDATE produto SET ativo = FALSE
      WHERE id_produto = ${id}
      RETURNING *
    `;
    if (!row) throw notFound();
    return { success: true, data: toProduto(row) };
  });
}
