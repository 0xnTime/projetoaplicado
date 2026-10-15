import { sql } from "bun";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@cantina/types";
import { HttpError } from "./http";

export interface Session {
  id: number;
  role: Role;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: number; purpose?: "reset"; fingerprint?: string };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    session: Session;
  }
}

export function authenticated(...roles: Role[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    let sub: number;
    try {
      const payload = await req.jwtVerify<{ sub: number; purpose?: "reset" }>();
      if (payload.purpose) throw new Error("reset token is not a session");
      sub = payload.sub;
    } catch {
      throw new HttpError(401, "Sessão inválida ou expirada");
    }
    const [user] = await sql<{ perfil: Role; ativo: boolean }[]>`
      SELECT perfil, ativo FROM usuario WHERE id_usuario = ${sub}
    `;
    if (!user || !user.ativo) throw new HttpError(401, "Sessão inválida ou expirada");
    if (roles.length > 0 && !roles.includes(user.perfil)) {
      throw new HttpError(403, "Acesso não permitido para este perfil");
    }
    req.session = { id: sub, role: user.perfil };
  };
}

export const adminOnly = authenticated("ADMINISTRADOR");

export const isAdmin = (req: FastifyRequest) => req.session.role === "ADMINISTRADOR";
