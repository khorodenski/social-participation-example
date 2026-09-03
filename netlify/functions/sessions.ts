import type { Config, Context } from '@netlify/functions';
import {
  SESSION_INDEX_KEY,
  deleteKey,
  ideasPrefix,
  imagesPrefix,
  listKeys,
  readJson,
  sessionKey,
  writeJson,
} from './_blobs';
import { json, jsonError } from './_http';
import { pl } from '../../src/i18n/pl';
import {
  createSessionSchema,
  sessionIndexSchema,
  sessionPatchSchema,
  sessionSchema,
  type Session,
  type SessionSummary,
} from '../../src/state/session';

/** F-1.4 — a short random session id. */
function newSessionId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function readIndex(): Promise<SessionSummary[]> {
  const raw = await readJson<unknown>(SESSION_INDEX_KEY);
  const parsed = sessionIndexSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

async function readSession(id: string): Promise<Session | null> {
  const raw = await readJson<unknown>(sessionKey(id));
  if (raw === null) return null;
  const parsed = sessionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const url = new URL(req.url);

  // Route from the path itself rather than from `context.params`: `netlify dev`
  // retries a 404 against static-file candidates such as
  // `/api/sessions/<id>/index.html`, which would otherwise fall through to the
  // "list" branch and answer 200.
  const segments = url.pathname
    .replace(/^\/api\/sessions/, '')
    .split('/')
    .filter((segment) => segment.length > 0);

  const id = segments[0];
  const tail = segments[1];

  if (segments.length > 2 || (tail !== undefined && tail !== 'reset' && tail !== 'public')) {
    return jsonError(pl.errors.notFound, 404);
  }

  try {
    /* ------------------------------------------------ /api/sessions (list) */
    if (id === undefined) {
      if (req.method === 'GET') {
        return json(await readIndex());
      }

      if (req.method === 'POST') {
        const body: unknown = await req.json().catch(() => null);
        const input = createSessionSchema.safeParse(body);
        if (!input.success) return jsonError(pl.errors.invalidBody, 400);

        const session: Session = sessionSchema.parse({
          id: newSessionId(),
          title: input.data.title,
          intro: input.data.intro ?? '',
          createdAt: Date.now(),
          stage: 'draft',
        });

        await writeJson(sessionKey(session.id), session);
        const index = await readIndex();
        index.unshift({ id: session.id, title: session.title, createdAt: session.createdAt });
        await writeJson(SESSION_INDEX_KEY, index);

        return json(session, 201);
      }

      return jsonError(pl.errors.methodNotAllowed, 405);
    }

    /* ------------------------------------------- /api/sessions/:id/* (one) */
    const session = await readSession(id);
    if (!session) return jsonError(pl.errors.notFound, 404);

    if (tail === 'public') {
      if (req.method !== 'GET') return jsonError(pl.errors.methodNotAllowed, 405);
      return json({ title: session.title, intro: session.intro, stage: session.stage });
    }

    if (tail === 'reset') {
      if (req.method !== 'POST') return jsonError(pl.errors.methodNotAllowed, 405);

      for (const key of await listKeys(ideasPrefix(id))) await deleteKey(key);
      for (const key of await listKeys(imagesPrefix(id))) await deleteKey(key);

      const reset: Session = {
        ...session,
        stage: 'draft',
        groups: [],
        selectedGroupIds: [],
        expansions: {},
        images: {},
      };
      await writeJson(sessionKey(id), reset);
      return json(reset);
    }

    if (req.method === 'GET') return json(session);

    if (req.method === 'PATCH') {
      const body: unknown = await req.json().catch(() => null);
      const patch = sessionPatchSchema.safeParse(body);
      if (!patch.success) return jsonError(pl.errors.invalidBody, 400);

      const updated: Session = sessionSchema.parse({ ...session, ...patch.data });
      await writeJson(sessionKey(id), updated);

      if (patch.data.title && patch.data.title !== session.title) {
        const index = await readIndex();
        const entry = index.find((s) => s.id === id);
        if (entry) {
          entry.title = updated.title;
          await writeJson(SESSION_INDEX_KEY, index);
        }
      }

      return json(updated);
    }

    return jsonError(pl.errors.methodNotAllowed, 405);
  } catch (err) {
    console.error('[social-voting] sessions error', err);
    return jsonError(pl.errors.serverError, 500);
  }
};

export const config: Config = {
  path: [
    '/api/sessions',
    '/api/sessions/:id',
    '/api/sessions/:id/reset',
    '/api/sessions/:id/public',
  ],
};
