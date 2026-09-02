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
import { z } from 'zod';

/**
 * Typed fetch wrappers for the Netlify Functions API.
 * These functions never see the Google API key — they only talk to our own
 * key-less persistence layer.
 */

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const errorBodySchema = z.object({ error: z.string() });

async function request<S extends z.ZodTypeAny>(
  path: string,
  init: RequestInit,
  schema: S,
): Promise<z.infer<S>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  const raw: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(raw);
    throw new ApiError(parsed.success ? parsed.data.error : res.statusText, res.status);
  }

  return schema.parse(raw);
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

/** Uploads a binary asset (resource image or generated image) to Blobs. */
export async function putAsset(
  key: string,
  data: Blob,
  contentType: string,
): Promise<{ key: string }> {
  const res = await fetch(`${API_BASE}/assets/${key}`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: data,
  });

  const raw: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(raw);
    throw new ApiError(parsed.success ? parsed.data.error : res.statusText, res.status);
  }

  return assetResultSchema.parse(raw);
}

/** The URL an <img> tag should use for a stored asset key. */
export function assetUrl(key: string): string {
  return `${API_BASE}/assets/${key}`;
}
