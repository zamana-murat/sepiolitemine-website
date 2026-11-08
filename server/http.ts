import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { drizzle } from 'drizzle-orm/d1';
import type { z } from 'zod';
import * as schema from './db/schema';
import type { AppEnv } from './env';

export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const db = (c: Context<AppEnv>) => drizzle(c.env.DB, { schema });

export const ok = <T>(c: Context<AppEnv>, data: T, status: ContentfulStatusCode = 200) =>
  c.json({ ok: true, data }, status);

export function idParam(c: Context<AppEnv>, name = 'id'): number {
  const n = Number(c.req.param(name));
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `Invalid ${name}`);
  return n;
}

export function validate<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError(
      400,
      'Validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export async function body<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON');
  }
  return validate(schema, raw);
}

export function found<T>(row: T | undefined, what = 'Record'): T {
  if (row === undefined) throw new ApiError(404, `${what} not found`);
  return row;
}

/** Collects the error message chain (Drizzle wraps D1 errors in `cause`). */
function messageChain(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let i = 0; cur && i < 5; i++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = cur.cause;
    } else break;
  }
  return parts.join(' | ');
}

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiError) {
    return c.json({ ok: false, error: err.message, details: err.details }, err.status);
  }
  // Thrown by Hono middleware (e.g. csrf → 403).
  if (err instanceof HTTPException) {
    return c.json({ ok: false, error: err.message || 'Request rejected' }, err.status);
  }
  const msg = messageChain(err);
  if (msg.includes('UNIQUE constraint failed')) {
    return c.json({ ok: false, error: 'Duplicate value (must be unique)' }, 409);
  }
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return c.json({ ok: false, error: 'Referenced record does not exist' }, 400);
  }
  console.error('Unhandled API error:', msg);
  return c.json({ ok: false, error: 'Internal error' }, 500);
};
