import type { Config, Context } from '@netlify/functions';
import { jsonError } from './_http';
import { pl } from '../../src/i18n/pl';

/**
 * Milestone 0 stub. Milestone 1 implements:
 *   POST /api/sessions/:id/ideas        -> { id }        (409 if not voting)
 *   GET  /api/sessions/:id/ideas        -> [{ id, text, createdAt }]
 *   GET  /api/sessions/:id/ideas/count  -> { count }
 * One blob per idea (D-2) so concurrent attendee writes never race.
 */
export default async (_req: Request, _context: Context): Promise<Response> => {
  return jsonError(pl.errors.notImplemented, 501);
};

export const config: Config = {
  path: ['/api/sessions/:id/ideas', '/api/sessions/:id/ideas/count'],
};
