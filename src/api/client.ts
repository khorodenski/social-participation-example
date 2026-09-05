import {
  publicSessionSchema,
  sessionIndexSchema,
  sessionSchema,
  type CreateSessionInput,
  type Idea,
  type PublicSession,
  type Session,
  type SessionPatch,
  type SessionSummary,
} from '../state/session';
import { ideaSchema } from '../state/session';
import { ASSET_MAX_BYTES, isAssetKey, normalizeContentType } from '../state/assets';
import { LocalizedError } from '../state/errors';
import { z } from 'zod';
import { pl } from '../i18n/pl';

/**
 * Typed fetch wrappers for the Netlify Functions API.
 * These functions never see the Google API key — they only talk to our own
 * key-less persistence layer.
 */

const API_BASE = '/api';

/**
 * Every `ApiError` message is Polish — see `state/errors.ts`. That is the whole
 * point of the class: a caller can render `.message` without checking.
 */
export class ApiError extends LocalizedError {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

const errorBodySchema = z.object({ error: z.string() });

/**
 * M6-2 — the Polish message for a response that carries none of its own.
 *
 * Our own functions always answer `{ "error": "<polish>" }`. This is for
 * everything else: a Netlify platform error, a function timeout, a CDN 404, a
 * body that was not JSON. The old fallback was `res.statusText`, which would
 * have put "Gateway Timeout" on a projected screen.
 */
function describeStatus(status: number): string {
  if (status === 404) return pl.errors.notFound;
  if (status === 408 || status === 504) return pl.errors.timeout;
  if (status === 502 || status === 503) return pl.errors.unavailable;
  if (status >= 500) return pl.errors.serverError;
  return pl.errors.badResponse;
}

/** Reads the function's own Polish message, or falls back to a Polish one. */
function apiError(raw: unknown, status: number): ApiError {
  const parsed = errorBodySchema.safeParse(raw);
  return new ApiError(parsed.success ? parsed.data.error : describeStatus(status), status);
}

/**
 * `fetch` rejects with an English `TypeError` when the network is gone, and
 * that is exactly what a lecture hall's wifi does. Every call goes through here
 * so it comes back as Polish instead.
 */
async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    throw new ApiError(pl.errors.network, 0, { cause: err });
  }
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  init: RequestInit,
  schema: S,
): Promise<z.infer<S>> {
  const res = await send(path, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const raw: unknown = await res.json().catch(() => null);

  if (!res.ok) throw apiError(raw, res.status);

  // A zod failure is an English JSON blob, and several screens render whatever
  // they catch. It means our own function answered in a shape we do not know,
  // which the lecturer can do nothing about beyond retrying.
  const checked = schema.safeParse(raw);
  if (!checked.success)
    throw new ApiError(pl.errors.badResponse, res.status, { cause: checked.error });

  return checked.data;
}

/* ---------------------------------------------------------------- sessions */

export function listSessions(): Promise<SessionSummary[]> {
  return request('/sessions', { method: 'GET' }, sessionIndexSchema);
}

export function createSession(input: CreateSessionInput): Promise<Session> {
  return request('/sessions', { method: 'POST', body: JSON.stringify(input) }, sessionSchema);
}

export function getSession(id: string): Promise<Session> {
  return request(`/sessions/${encodeURIComponent(id)}`, { method: 'GET' }, sessionSchema);
}

export function patchSession(id: string, patch: SessionPatch): Promise<Session> {
  return request(
    `/sessions/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    sessionSchema,
  );
}

export function resetSession(id: string): Promise<Session> {
  return request(`/sessions/${encodeURIComponent(id)}/reset`, { method: 'POST' }, sessionSchema);
}

export function getPublicSession(id: string): Promise<PublicSession> {
  return request(
    `/sessions/${encodeURIComponent(id)}/public`,
    { method: 'GET' },
    publicSessionSchema,
  );
}

/* ------------------------------------------------------------------- ideas */

const submitIdeaResultSchema = z.object({ id: z.string() });
const ideaCountSchema = z.object({ count: z.number() });

export function submitIdea(sessionId: string, text: string): Promise<{ id: string }> {
  return request(
    `/sessions/${encodeURIComponent(sessionId)}/ideas`,
    { method: 'POST', body: JSON.stringify({ text }) },
    submitIdeaResultSchema,
  );
}

export function listIdeas(sessionId: string): Promise<Idea[]> {
  return request(
    `/sessions/${encodeURIComponent(sessionId)}/ideas`,
    { method: 'GET' },
    z.array(ideaSchema),
  );
}

export function getIdeaCount(sessionId: string): Promise<{ count: number }> {
  return request(
    `/sessions/${encodeURIComponent(sessionId)}/ideas/count`,
    { method: 'GET' },
    ideaCountSchema,
  );
}

/* ------------------------------------------------------------------ assets */

const assetResultSchema = z.object({ key: z.string() });

/**
 * Uploads a binary asset (resource image or generated image) to Blobs.
 *
 * The three checks below are the same ones `assets.ts` makes server-side, from
 * the same module. They are here so a bad key or an oversized photo fails on
 * the lecturer's own screen while there is still time to fix it, rather than as
 * a 400 in the middle of a lecture. Build keys with `resourceAssetKey` or
 * `generatedImageKey` and they always pass.
 */
export async function putAsset(
  key: string,
  data: Blob,
  contentType: string,
): Promise<{ key: string }> {
  if (!isAssetKey(key)) throw new ApiError(pl.errors.assetKey, 400);
  if (!normalizeContentType(contentType)) throw new ApiError(pl.errors.assetType, 415);
  if (data.size > ASSET_MAX_BYTES) throw new ApiError(pl.errors.assetTooLarge, 413);

  const res = await send(`/assets/${key}`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: data,
  });

  const raw: unknown = await res.json().catch(() => null);

  if (!res.ok) throw apiError(raw, res.status);

  const checked = assetResultSchema.safeParse(raw);
  if (!checked.success)
    throw new ApiError(pl.errors.badResponse, res.status, { cause: checked.error });

  return checked.data;
}

/** The URL an <img> tag should use for a stored asset key. */
export function assetUrl(key: string): string {
  return `${API_BASE}/assets/${key}`;
}
