import type { Config, Context } from '@netlify/functions';
import { jsonError } from './_http';
import { pl } from '../../src/i18n/pl';

/**
 * Milestone 0 stub. Milestone 2/5 implement:
 *   PUT /api/assets/*  -> { key }   (binary body, content-type header)
 *   GET /api/assets/*  -> binary with the stored content-type
 * Keys are the D-3 paths, e.g. sessions/<id>/resources/r1.jpg.
 */
export default async (_req: Request, _context: Context): Promise<Response> => {
  return jsonError(pl.errors.notImplemented, 501);
};

export const config: Config = {
  path: '/api/assets/*',
};
