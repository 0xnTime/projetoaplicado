import { sql, type SQL } from "bun";
import { z } from "zod";

const TIMEZONE = "America/Sao_Paulo";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const idParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const periodoQuery = z.object({
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
});

export function periodoFilter(coluna: SQL.Query<unknown>, de?: string, ate?: string) {
  return sql`
    ${de ? sql`AND ${coluna} >= ${de}::timestamp AT TIME ZONE ${TIMEZONE}` : sql``}
    ${ate ? sql`AND ${coluna} < (${ate}::date + 1)::timestamp AT TIME ZONE ${TIMEZONE}` : sql``}
  `;
}
