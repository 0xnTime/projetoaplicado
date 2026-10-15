import { sql, type SQL } from "bun";
import { z } from "zod";

export const TIMEZONE = "America/Sao_Paulo";

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

export const periodQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export function periodFilter(column: SQL.Query<unknown>, from?: string, to?: string) {
  return sql`
    ${from ? sql`AND ${column} >= ${from}::timestamp AT TIME ZONE ${TIMEZONE}` : sql``}
    ${to ? sql`AND ${column} < (${to}::date + 1)::timestamp AT TIME ZONE ${TIMEZONE}` : sql``}
  `;
}
