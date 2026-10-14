import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, Perfil, Usuario } from "@cantina/types";
import { apenasAdmin } from "../lib/auth";
import { HttpError, idParams } from "../lib/http";

export interface UsuarioRow {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: Perfil;
  saldo: string;
  ativo: boolean;
  data_cadastro: Date;
}

export const columns = sql`id_usuario, nome, email, perfil, saldo, ativo, data_cadastro`;

export function toUsuario(row: UsuarioRow): Usuario {
  return {
    idUsuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    saldo: Number(row.saldo),
    ativo: row.ativo,
    dataCadastro: row.data_cadastro.toISOString(),
  };
}

const listQuery = z.object({
  busca: z.string().trim().min(1).optional(),
  perfil: z.enum(["ADMINISTRADOR", "CONSUMIDOR"]).optional(),
  ativo: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const createBody = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(160),
  senha: z.string().min(8).max(72),
  perfil: z.enum(["ADMINISTRADOR", "CONSUMIDOR"]).default("CONSUMIDOR"),
});

const updateBody = z
  .object({
    nome: z.string().trim().min(1).max(120),
    email: z.email().trim().toLowerCase().max(160),
    senha: z.string().min(8).max(72),
    perfil: z.enum(["ADMINISTRADOR", "CONSUMIDOR"]),
    ativo: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

const notFound = () => new HttpError(404, "Usuário não encontrado");

// admin n pode se lockar 
const proprioAcesso = () =>
  new HttpError(422, "Você não pode desativar nem alterar o perfil da sua própria conta");

export async function usuarioRoutes(app: FastifyInstance) {
  app.addHook("onRequest", apenasAdmin);

  app.get("/api/usuarios", async (req): Promise<ApiResult<Usuario[]>> => {
    const { busca, perfil, ativo } = listQuery.parse(req.query);
    const rows = await sql<UsuarioRow[]>`
      SELECT ${columns} FROM usuario
      WHERE TRUE
        ${busca ? sql`AND (nome ILIKE ${"%" + busca + "%"} OR email ILIKE ${"%" + busca + "%"})` : sql``}
        ${perfil ? sql`AND perfil = ${perfil}` : sql``}
        ${ativo !== undefined ? sql`AND ativo = ${ativo}` : sql``}
      ORDER BY nome
    `;
    return { success: true, data: rows.map(toUsuario) };
  });

  app.get("/api/usuarios/:id", async (req): Promise<ApiResult<Usuario>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<UsuarioRow[]>`SELECT ${columns} FROM usuario WHERE id_usuario = ${id}`;
    if (!row) throw notFound();
    return { success: true, data: toUsuario(row) };
  });

  app.post("/api/usuarios", async (req, reply): Promise<ApiResult<Usuario>> => {
    const body = createBody.parse(req.body);
    const senhaHash = await Bun.password.hash(body.senha);
    const [row] = await sql<UsuarioRow[]>`
      INSERT INTO usuario (nome, email, senha_hash, perfil)
      VALUES (${body.nome}, ${body.email}, ${senhaHash}, ${body.perfil})
      RETURNING ${columns}
    `;
    return reply.code(201).send({ success: true, data: toUsuario(row!) });
  });

  app.patch("/api/usuarios/:id", async (req): Promise<ApiResult<Usuario>> => {
    const { id } = idParams.parse(req.params);
    const body = updateBody.parse(req.body);
    if (id === req.sessao.id && (body.ativo === false || (body.perfil && body.perfil !== req.sessao.perfil))) {
      throw proprioAcesso();
    }
    const changes = {
      nome: body.nome,
      email: body.email,
      senha_hash: body.senha && (await Bun.password.hash(body.senha)),
      perfil: body.perfil,
      ativo: body.ativo,
    };
    const keys = (Object.keys(changes) as (keyof typeof changes)[]).filter(
      (k) => changes[k] !== undefined,
    );
    const [row] = await sql<UsuarioRow[]>`
      UPDATE usuario SET ${sql(changes, ...keys)}
      WHERE id_usuario = ${id}
      RETURNING ${columns}
    `;
    if (!row) throw notFound();
    return { success: true, data: toUsuario(row) };
  });

  app.delete("/api/usuarios/:id", async (req): Promise<ApiResult<Usuario>> => {
    const { id } = idParams.parse(req.params);
    if (id === req.sessao.id) throw proprioAcesso();
    const [row] = await sql<UsuarioRow[]>`
      UPDATE usuario SET ativo = FALSE
      WHERE id_usuario = ${id}
      RETURNING ${columns}
    `;
    if (!row) throw notFound();
    return { success: true, data: toUsuario(row) };
  });
}
