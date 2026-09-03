import type { Config, Context } from '@netlify/functions';
import { ideaKey, ideasPrefix, listKeys, readJson, sessionKey, writeJson } from './_blobs';
import { json, jsonError } from './_http';
import { pl } from '../../src/i18n/pl';
import {
  ideaSchema,
  ideaTextSchema,
  sessionSchema,
  type Idea,
  type Session,
} from '../../src/state/session';

/**
 * Attendee submissions (F-4.3) and the lecturer's reads.
 *
 *   POST /api/sessions/:id/ideas        -> { id }   409 when not voting
 *   GET  /api/sessions/:id/ideas        -> Idea[]   newest last
 *   GET  /api/sessions/:id/ideas/count  -> { count }
 *
 * One blob per idea (D-2) so two attendees submitting at the same moment can
 * never overwrite each other.
 */

/** Short, collision-tolerant: a session holds ~100 of these at most (N-3). */
function newIdeaId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function readSession(id: string): Promise<Session | null> {
  const raw = await readJson<unknown>(sessionKey(id));
  if (raw === null) return null;
  const parsed = sessionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const url = new URL(req.url);

  // Routed from the path rather than context.params, for the same reason as
  // sessions.ts: `netlify dev` retries a 404 against static-file candidates.
  const segments = url.pathname
    .replace(/^\/api\/sessions/, '')
    .split('/')
    .filter((segment) => segment.length > 0);

  const [sessionId, collection, tail] = segments;

  if (!sessionId || collection !== 'ideas' || (tail !== undefined && tail !== 'count')) {
    return jsonError(pl.errors.notFound, 404);
  }

  try {
    /* ------------------------------------ GET .../ideas/count — the counter */

    if (tail === 'count') {
      if (req.method !== 'GET') return jsonError(pl.errors.methodNotAllowed, 405);

      // Counting keys avoids reading every blob; the counter polls every 3 s.
      const keys = await listKeys(ideasPrefix(sessionId));
      return json({ count: keys.length });
    }

    /* ------------------------------------------ GET .../ideas — the lecturer */

    if (req.method === 'GET') {
      const keys = await listKeys(ideasPrefix(sessionId));
      const raws = await Promise.all(keys.map((key) => readJson<unknown>(key)));

      const ideas: Idea[] = [];
      for (const raw of raws) {
        const parsed = ideaSchema.safeParse(raw);
        if (parsed.success) ideas.push(parsed.data);
      }

      ideas.sort((a, b) => a.createdAt - b.createdAt);
      return json(ideas);
    }

    /* ----------------------------------------- POST .../ideas — the attendee */

    if (req.method === 'POST') {
      const session = await readSession(sessionId);
      if (!session) return jsonError(pl.errors.notFound, 404);

      // F-4.3: submissions are only accepted while voting is open.
      if (session.stage !== 'voting') return jsonError(pl.errors.notVoting, 409);

      const body: unknown = await req.json().catch(() => null);
      const text = (body as { text?: unknown } | null)?.text;
      const parsed = ideaTextSchema.safeParse(text);

      if (!parsed.success) {
        const tooShort = typeof text === 'string' && text.trim().length < 10;
        return jsonError(tooShort ? pl.attendee.tooShort : pl.attendee.tooLong, 400);
      }

      const idea: Idea = {
        id: newIdeaId(),
        text: parsed.data,
        createdAt: Date.now(),
      };

      await writeJson(ideaKey(sessionId, idea.id), idea);
      return json({ id: idea.id }, 201);
    }

    return jsonError(pl.errors.methodNotAllowed, 405);
  } catch (err) {
    console.error('[social-voting] ideas error', err);
    return jsonError(pl.errors.serverError, 500);
  }
};

export const config: Config = {
  path: ['/api/sessions/:id/ideas', '/api/sessions/:id/ideas/count'],
};
