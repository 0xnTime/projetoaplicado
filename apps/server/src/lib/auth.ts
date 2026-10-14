import { sql } from "bun";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Perfil } from "@cantina/types";
import { HttpError } from "./http";

export interface Sessao {
  id: number;
  perfil: Perfil;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: number };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    sessao: Sessao;
  }
}

export function autenticado(...perfis: Perfil[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    let sub: number;
    try {
      ({ sub } = await req.jwtVerify<{ sub: number }>());
    } catch {
      throw new HttpError(401, "Sessão inválida ou expirada");
    }
    const [usuario] = await sql<{ perfil: Perfil; ativo: boolean }[]>`
      SELECT perfil, ativo FROM usuario WHERE id_usuario = ${sub}
    `;
    if (!usuario || !usuario.ativo) throw new HttpError(401, "Sessão inválida ou expirada");
    if (perfis.length > 0 && !perfis.includes(usuario.perfil)) {
      throw new HttpError(403, "Acesso não permitido para este perfil");
    }
    req.sessao = { id: sub, perfil: usuario.perfil };
  };
}

export const apenasAdmin = autenticado("ADMINISTRADOR");

export const isAdmin = (req: FastifyRequest) => req.sessao.perfil === "ADMINISTRADOR";
