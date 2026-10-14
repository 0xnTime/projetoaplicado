import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, LoginResponse, Usuario } from "@cantina/types";
import { autenticado } from "../lib/auth";
import { HttpError } from "../lib/http";
import { columns, toUsuario, type UsuarioRow } from "./usuarios";

const cadastroBody = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(160),
  senha: z.string().min(8).max(72),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
  senha: z.string().min(1),
});

const hashFalso = await Bun.password.hash("senha-inexistente");

const credenciaisInvalidas = () => new HttpError(401, "E-mail ou senha inválidos");

export async function authRoutes(app: FastifyInstance) {
  const emitirToken = (row: UsuarioRow): LoginResponse => ({
    token: app.jwt.sign({ sub: row.id_usuario }),
    usuario: toUsuario(row),
  });

  app.post("/api/auth/cadastro", async (req, reply): Promise<ApiResult<LoginResponse>> => {
    const body = cadastroBody.parse(req.body);
    const senhaHash = await Bun.password.hash(body.senha);
    const [row] = await sql<UsuarioRow[]>`
      INSERT INTO usuario (nome, email, senha_hash, perfil)
      VALUES (${body.nome}, ${body.email}, ${senhaHash}, 'CONSUMIDOR')
      RETURNING ${columns}
    `;
    return reply.code(201).send({ success: true, data: emitirToken(row!) });
  });

  app.post("/api/auth/login", async (req): Promise<ApiResult<LoginResponse>> => {
    const body = loginBody.parse(req.body);
    const [row] = await sql<(UsuarioRow & { senha_hash: string })[]>`
      SELECT ${columns}, senha_hash FROM usuario WHERE email = ${body.email}
    `;
    const ok = await Bun.password.verify(body.senha, row?.senha_hash ?? hashFalso);
    if (!row || !ok) throw credenciaisInvalidas();
    if (!row.ativo) throw new HttpError(403, "Usuário desativado, procure a administração da cantina");
    return { success: true, data: emitirToken(row) };
  });

  app.get("/api/auth/me", { onRequest: autenticado() }, async (req): Promise<ApiResult<Usuario>> => {
    const [row] = await sql<UsuarioRow[]>`
      SELECT ${columns} FROM usuario WHERE id_usuario = ${req.sessao.id}
    `;
    return { success: true, data: toUsuario(row!) };
  });
}
