import type { Config, Context } from '@netlify/functions';
import { activeBackend } from './_blobs';
import { json, jsonError } from './_http';
import { pl } from '../../src/i18n/pl';

export default async (_req: Request, _context: Context): Promise<Response> => {
  try {
    return json({ ok: true, storage: await activeBackend() });
  } catch (err) {
    console.error('[social-voting] health error', err);
    return jsonError(pl.errors.serverError, 500);
  }
};

export const config: Config = {
  path: '/api/health',
};
