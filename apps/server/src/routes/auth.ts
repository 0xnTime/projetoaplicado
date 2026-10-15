import { sql } from "bun";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiResult, LoginResponse, User } from "@cantina/types";
import { env } from "../config/env";
import { authenticated } from "../lib/auth";
import { HttpError } from "../lib/http";
import { columns, toUser, type UserRow } from "./users";

const signupBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(160),
  password: z.string().min(8).max(72),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const forgotPasswordBody = z.object({
  email: z.string().trim().toLowerCase().min(1),
});

const resetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

// changes whenever the password changes, so a reset link only works once
const passwordFingerprint = (passwordHash: string) =>
  new Bun.CryptoHasher("sha256").update(passwordHash).digest("hex").slice(0, 16);

const invalidResetLink = () => new HttpError(400, "Link de redefinição inválido ou expirado");

const dummyHash = await Bun.password.hash("nonexistent-password");

const invalidCredentials = () => new HttpError(401, "E-mail ou senha inválidos");

export async function authRoutes(app: FastifyInstance) {
  const issueToken = (row: UserRow): LoginResponse => ({
    token: app.jwt.sign({ sub: row.id_usuario }),
    user: toUser(row),
  });

  app.post("/api/auth/cadastro", async (req, reply): Promise<ApiResult<LoginResponse>> => {
    const body = signupBody.parse(req.body);
    const passwordHash = await Bun.password.hash(body.password);
    const [row] = await sql<UserRow[]>`
      INSERT INTO usuario (nome, email, senha_hash, perfil)
      VALUES (${body.name}, ${body.email}, ${passwordHash}, 'CONSUMIDOR')
      RETURNING ${columns}
    `;
    return reply.code(201).send({ success: true, data: issueToken(row!) });
  });

  app.post("/api/auth/login", async (req): Promise<ApiResult<LoginResponse>> => {
    const body = loginBody.parse(req.body);
    const [row] = await sql<(UserRow & { senha_hash: string })[]>`
      SELECT ${columns}, senha_hash FROM usuario WHERE email = ${body.email}
    `;
    const ok = await Bun.password.verify(body.password, row?.senha_hash ?? dummyHash);
    if (!row || !ok) throw invalidCredentials();
    if (!row.ativo) throw new HttpError(403, "Usuário desativado, procure a administração da cantina");
    return { success: true, data: issueToken(row) };
  });

  // TODO: send by e-mail; for now the link only shows up in the server log
  app.post("/api/auth/esqueci-senha", async (req): Promise<ApiResult<null>> => {
    const body = forgotPasswordBody.parse(req.body);
    const [row] = await sql<{ id_usuario: number; senha_hash: string }[]>`
      SELECT id_usuario, senha_hash FROM usuario WHERE email = ${body.email} AND ativo
    `;
    if (row) {
      const token = app.jwt.sign(
        { sub: row.id_usuario, purpose: "reset", fingerprint: passwordFingerprint(row.senha_hash) },
        { expiresIn: "30m" },
      );
      req.log.info({ email: body.email, link: `${env.APP_URL}/?redefinir=${token}` }, "password reset link");
    }
    // same response whether or not the e-mail exists, so it doesn't reveal who has an account
    return { success: true, data: null };
  });

  app.post("/api/auth/redefinir-senha", async (req): Promise<ApiResult<LoginResponse>> => {
    const body = resetPasswordBody.parse(req.body);
    let payload: { sub: number; purpose?: "reset"; fingerprint?: string };
    try {
      payload = app.jwt.verify(body.token);
    } catch {
      throw invalidResetLink();
    }
    if (payload.purpose !== "reset") throw invalidResetLink();

    const [current] = await sql<{ senha_hash: string; ativo: boolean }[]>`
      SELECT senha_hash, ativo FROM usuario WHERE id_usuario = ${payload.sub}
    `;
    if (!current || !current.ativo || passwordFingerprint(current.senha_hash) !== payload.fingerprint) {
      throw invalidResetLink();
    }

    const passwordHash = await Bun.password.hash(body.password);
    const [row] = await sql<UserRow[]>`
      UPDATE usuario SET senha_hash = ${passwordHash}
      WHERE id_usuario = ${payload.sub} AND senha_hash = ${current.senha_hash}
      RETURNING ${columns}
    `;
    if (!row) throw invalidResetLink();
    return { success: true, data: issueToken(row) };
  });

  app.get("/api/auth/me", { onRequest: authenticated() }, async (req): Promise<ApiResult<User>> => {
    const [row] = await sql<UserRow[]>`
      SELECT ${columns} FROM usuario WHERE id_usuario = ${req.session.id}
    `;
    return { success: true, data: toUser(row!) };
  });
}
