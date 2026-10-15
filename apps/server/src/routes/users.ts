import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, Role, User } from "@cantina/types";
import { adminOnly } from "../lib/auth";
import { HttpError, idParams } from "../lib/http";

export interface UserRow {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: Role;
  saldo: string;
  ativo: boolean;
  data_cadastro: Date;
}

export const columns = sql`id_usuario, nome, email, perfil, saldo, ativo, data_cadastro`;

export function toUser(row: UserRow): User {
  return {
    id: row.id_usuario,
    name: row.nome,
    email: row.email,
    role: row.perfil,
    balance: Number(row.saldo),
    active: row.ativo,
    createdAt: row.data_cadastro.toISOString(),
  };
}

const role = z.enum(["ADMINISTRADOR", "CONSUMIDOR"]);

const listQuery = z.object({
  search: z.string().trim().min(1).optional(),
  role: role.optional(),
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const createBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(160),
  password: z.string().min(8).max(72),
  role: role.default("CONSUMIDOR"),
});

const updateBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.email().trim().toLowerCase().max(160),
    password: z.string().min(8).max(72),
    role,
    active: z.boolean(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

const notFound = () => new HttpError(404, "Usuário não encontrado");

// an admin can't lock themselves out
const ownAccount = () =>
  new HttpError(422, "Você não pode desativar nem alterar o perfil da sua própria conta");

export async function userRoutes(app: FastifyInstance) {
  app.addHook("onRequest", adminOnly);

  app.get("/api/usuarios", async (req): Promise<ApiResult<User[]>> => {
    const { search, role, active } = listQuery.parse(req.query);
    const rows = await sql<UserRow[]>`
      SELECT ${columns} FROM usuario
      WHERE TRUE
        ${search ? sql`AND (nome ILIKE ${"%" + search + "%"} OR email ILIKE ${"%" + search + "%"})` : sql``}
        ${role ? sql`AND perfil = ${role}` : sql``}
        ${active !== undefined ? sql`AND ativo = ${active}` : sql``}
      ORDER BY nome
    `;
    return { success: true, data: rows.map(toUser) };
  });

  app.get("/api/usuarios/:id", async (req): Promise<ApiResult<User>> => {
    const { id } = idParams.parse(req.params);
    const [row] = await sql<UserRow[]>`SELECT ${columns} FROM usuario WHERE id_usuario = ${id}`;
    if (!row) throw notFound();
    return { success: true, data: toUser(row) };
  });

  app.post("/api/usuarios", async (req, reply): Promise<ApiResult<User>> => {
    const body = createBody.parse(req.body);
    const passwordHash = await Bun.password.hash(body.password);
    const [row] = await sql<UserRow[]>`
      INSERT INTO usuario (nome, email, senha_hash, perfil)
      VALUES (${body.name}, ${body.email}, ${passwordHash}, ${body.role})
      RETURNING ${columns}
    `;
    return reply.code(201).send({ success: true, data: toUser(row!) });
  });

  app.patch("/api/usuarios/:id", async (req): Promise<ApiResult<User>> => {
    const { id } = idParams.parse(req.params);
    const body = updateBody.parse(req.body);
    if (id === req.session.id && (body.active === false || (body.role && body.role !== req.session.role))) {
      throw ownAccount();
    }
    const changes = {
      nome: body.name,
      email: body.email,
      senha_hash: body.password && (await Bun.password.hash(body.password)),
      perfil: body.role,
      ativo: body.active,
    };
    const keys = (Object.keys(changes) as (keyof typeof changes)[]).filter(
      (k) => changes[k] !== undefined,
    );
    const [row] = await sql<UserRow[]>`
      UPDATE usuario SET ${sql(changes, ...keys)}
      WHERE id_usuario = ${id}
      RETURNING ${columns}
    `;
    if (!row) throw notFound();
    return { success: true, data: toUser(row) };
  });

  app.delete("/api/usuarios/:id", async (req): Promise<ApiResult<User>> => {
    const { id } = idParams.parse(req.params);
    if (id === req.session.id) throw ownAccount();
    const [row] = await sql<UserRow[]>`
      UPDATE usuario SET ativo = FALSE
      WHERE id_usuario = ${id}
      RETURNING ${columns}
    `;
    if (!row) throw notFound();
    return { success: true, data: toUser(row) };
  });
}
