import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, Product } from "@cantina/types";
import { adminOnly, authenticated, isAdmin } from "../lib/auth";
import { HttpError, idParams } from "../lib/http";
import { MAX_PHOTO_BYTES, removePhoto, savePhoto } from "../lib/uploads";

interface ProductRow {
  id_produto: number;
  nome: string;
  categoria: string;
  preco: string;
  estoque: number;
  codigo_barras: string;
  foto: string | null;
  ativo: boolean;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id_produto,
    name: row.nome,
    category: row.categoria,
    price: Number(row.preco),
    stock: row.estoque,
    barcode: row.codigo_barras,
    photo: row.foto,
    active: row.ativo,
  };
}

const listQuery = z.object({
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const createBody = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  price: z.number().nonnegative().multipleOf(0.01),
  stock: z.number().int().nonnegative(),
  barcode: z.string().trim().min(1).max(50),
});

const updateBody = createBody.partial().refine((b) => Object.keys(b).length > 0, {
  message: "Informe ao menos um campo para atualizar",
});

const notFound = () => new HttpError(404, "Produto não encontrado");

const invalidPhoto = () => new HttpError(415, "Envie uma imagem JPEG, PNG ou WebP de até 5 MB");

// sets foto and returns the product together with the previous foto, so the old file can be removed
async function replacePhoto(id: number, photo: string | null) {
  const [row] = await sql<(ProductRow & { old_foto: string | null })[]>`
    UPDATE produto p SET foto = ${photo}
    FROM (SELECT foto AS old_foto FROM produto WHERE id_produto = ${id} FOR UPDATE) old
    WHERE p.id_produto = ${id}
    RETURNING p.*, old.old_foto
  `;
  return row;
}

export async function productRoutes(app: FastifyInstance) {
  // photos are sent as the raw request body, e.g. fetch(url, { method: "PUT", body: file })
  app.addContentTypeParser(/^image\//, { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.get("/api/produtos", { onRequest: authenticated() }, async (req): Promise<ApiResult<Product[]>> => {
    const { name, category, ...query } = listQuery.parse(req.query);
    const active = isAdmin(req) ? query.active : true;
    const rows = await sql<ProductRow[]>`
      SELECT * FROM produto
      WHERE TRUE
        ${name ? sql`AND nome ILIKE ${"%" + name + "%"}` : sql``}
        ${category ? sql`AND categoria ILIKE ${"%" + category + "%"}` : sql``}
        ${active !== undefined ? sql`AND ativo = ${active}` : sql``}
      ORDER BY nome
    `;
    return { success: true, data: rows.map(toProduct) };
  });

  app.get("/api/produtos/:id", { onRequest: authenticated() }, async (req): Promise<ApiResult<Product>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<ProductRow[]>`SELECT * FROM produto WHERE id_produto = ${id}`;
    if (!row || (!row.ativo && !isAdmin(req))) throw notFound();
    return { success: true, data: toProduct(row) };
  });

  app.post("/api/produtos", { onRequest: adminOnly }, async (req, reply): Promise<ApiResult<Product>> => {
    const body = createBody.parse(req.body);
    const [row] = await sql<ProductRow[]>`
      INSERT INTO produto (nome, categoria, preco, estoque, codigo_barras, foto)
      VALUES (${body.name}, ${body.category}, ${body.price}, ${body.stock},
              ${body.barcode}, NULL)
      RETURNING *
    `;
    return reply.code(201).send({ success: true, data: toProduct(row!) });
  });

  app.patch("/api/produtos/:id", { onRequest: adminOnly }, async (req): Promise<ApiResult<Product>> => {
    const { id } = idParams.parse(req.params);
    const body = updateBody.parse(req.body);
    const changes = {
      nome: body.name,
      categoria: body.category,
      preco: body.price,
      estoque: body.stock,
      codigo_barras: body.barcode,
    };
    const columns = (Object.keys(changes) as (keyof typeof changes)[]).filter(
      (k) => changes[k] !== undefined,
    );
    const [row] = await sql<ProductRow[]>`
      UPDATE produto SET ${sql(changes, ...columns)}
      WHERE id_produto = ${id}
      RETURNING *
    `;
    if (!row) throw notFound();
    return { success: true, data: toProduct(row) };
  });

  app.delete("/api/produtos/:id", { onRequest: adminOnly }, async (req): Promise<ApiResult<Product>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<ProductRow[]>`
      UPDATE produto SET ativo = FALSE
      WHERE id_produto = ${id}
      RETURNING *
    `;
    if (!row) throw notFound();
    return { success: true, data: toProduct(row) };
  });

  app.put(
    "/api/produtos/:id/foto",
    { onRequest: adminOnly, bodyLimit: MAX_PHOTO_BYTES },
    async (req): Promise<ApiResult<Product>> => {
      const { id } = idParams.parse(req.params);
      if (!Buffer.isBuffer(req.body)) throw invalidPhoto();
      const photo = await savePhoto(req.body);
      if (!photo) throw invalidPhoto();
      const row = await replacePhoto(id, photo).catch(async (err) => {
        await removePhoto(photo);
        throw err;
      });
      if (!row) {
        await removePhoto(photo);
        throw notFound();
      }
      await removePhoto(row.old_foto);
      return { success: true, data: toProduct(row) };
    },
  );

  app.delete("/api/produtos/:id/foto", { onRequest: adminOnly }, async (req): Promise<ApiResult<Product>> => {
    const { id } = idParams.parse(req.params);
    const row = await replacePhoto(id, null);
    if (!row) throw notFound();
    await removePhoto(row.old_foto);
    return { success: true, data: toProduct(row) };
  });
}
