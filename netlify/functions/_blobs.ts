import { getStore as getNetlifyStore, type Store as NetlifyStore } from '@netlify/blobs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Storage helper for the functions.
 *
 * Primary backend is Netlify Blobs (store name `social-voting`). When Blobs is
 * not available — typically `netlify dev` without a linked site — we fall back
 * transparently to a file-backed store under `.netlify/local-blobs/` so the
 * whole app still runs locally. Exactly one line is logged saying which backend
 * won.
 */

export const STORE_NAME = 'social-voting';

/* ------------------------------------------------------------ key layout */

/** The D-1..D-4 key layout, in one place so the functions cannot disagree. */
export const SESSION_INDEX_KEY = 'sessions/index.json';

export const sessionKey = (sessionId: string) => `sessions/${sessionId}.json`;
export const ideasPrefix = (sessionId: string) => `sessions/${sessionId}/ideas/`;
export const ideaKey = (sessionId: string, ideaId: string) =>
  `${ideasPrefix(sessionId)}${ideaId}.json`;
export const imagesPrefix = (sessionId: string) => `sessions/${sessionId}/images/`;
export const resourcesPrefix = (sessionId: string) => `sessions/${sessionId}/resources/`;

export type StorageBackend = 'blobs' | 'file';

export interface StoredBlob {
  data: Uint8Array;
  contentType: string;
}

export interface Store {
  readonly backend: StorageBackend;
  getText(key: string): Promise<string | null>;
  setText(key: string, value: string): Promise<void>;
  getBinary(key: string): Promise<StoredBlob | null>;
  setBinary(key: string, data: Uint8Array, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/* ------------------------------------------------------------ blobs backend */

/**
 * A fresh Netlify client per operation, on purpose.
 *
 * `getStore()` copies the short-lived signed token out of
 * `NETLIFY_BLOBS_CONTEXT` and keeps it inside the client it returns. Netlify
 * refreshes that variable on every invocation, but a warm Lambda container
 * reuses module state, so a client held at module scope keeps presenting the
 * token it was born with. Once that token passes its expiry every call fails
 * with `BlobsInternalError: Failed to decode token: Token expired`, and the
 * container stays broken until it is recycled. Building the client per call is
 * cheap — it makes no network request — and always reads the current token.
 */
function netlifyStore(): NetlifyStore {
  return getNetlifyStore({ name: STORE_NAME, consistency: 'strong' });
}

const blobsStore: Store = {
  backend: 'blobs',

  async getText(key) {
    return (await netlifyStore().get(key, { type: 'text' })) ?? null;
  },

  async setText(key, value) {
    await netlifyStore().set(key, value);
  },

  async getBinary(key) {
    const res = await netlifyStore().getWithMetadata(key, { type: 'arrayBuffer' });
    if (!res) return null;
    const contentType =
      typeof res.metadata?.contentType === 'string'
        ? res.metadata.contentType
        : 'application/octet-stream';
    return { data: new Uint8Array(res.data), contentType };
  },

  async setBinary(key, data, contentType) {
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    await netlifyStore().set(key, buffer, { metadata: { contentType } });
  },

  async remove(key) {
    await netlifyStore().delete(key);
  },

  async list(prefix) {
    const res = await netlifyStore().list({ prefix });
    return res.blobs.map((b) => b.key);
  },
};

/* ------------------------------------------------------------- file backend */

const FILE_ROOT = path.resolve(process.cwd(), '.netlify', 'local-blobs', STORE_NAME);

function filePath(key: string): string {
  const safe = key
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
  return path.join(FILE_ROOT, safe);
}

function metaPath(key: string): string {
  return `${filePath(key)}.meta.json`;
}

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (!entry.name.endsWith('.meta.json')) {
      out.push(path.relative(FILE_ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

const fileStore: Store = {
  backend: 'file',

  async getText(key) {
    try {
      return await fs.readFile(filePath(key), 'utf8');
    } catch {
      return null;
    }
  },

  async setText(key, value) {
    const target = filePath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, value, 'utf8');
  },

  async getBinary(key) {
    try {
      const data = await fs.readFile(filePath(key));
      let contentType = 'application/octet-stream';
      try {
        const meta: unknown = JSON.parse(await fs.readFile(metaPath(key), 'utf8'));
        if (
          meta &&
          typeof meta === 'object' &&
          typeof (meta as { contentType?: unknown }).contentType === 'string'
        ) {
          contentType = (meta as { contentType: string }).contentType;
        }
      } catch {
        /* no sidecar — keep the default content type */
      }
      return { data: new Uint8Array(data), contentType };
    } catch {
      return null;
    }
  },

  async setBinary(key, data, contentType) {
    const target = filePath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    await fs.writeFile(metaPath(key), JSON.stringify({ contentType }), 'utf8');
  },

  async remove(key) {
    await fs.rm(filePath(key), { force: true });
    await fs.rm(metaPath(key), { force: true });
  },

  async list(prefix) {
    const all = await walk(FILE_ROOT);
    return all.filter((key) => key.startsWith(prefix));
  },
};

/* --------------------------------------------------------------- selection */

/**
 * Only the *decision* is memoised, never a client. Which backend is available
 * cannot change inside one container; a token can and does expire inside one.
 */
let backendPromise: Promise<StorageBackend> | null = null;

async function selectBackend(): Promise<StorageBackend> {
  try {
    // Probe: a cheap call that fails fast when Blobs is not configured.
    await netlifyStore().list({ prefix: '__probe__' });
    console.log(`[social-voting] storage backend: blobs (store "${STORE_NAME}")`);
    return 'blobs';
  } catch (err) {
    console.log(
      `[social-voting] storage backend: file (.netlify/local-blobs) — Blobs unavailable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return 'file';
  }
}

export async function getStore(): Promise<Store> {
  backendPromise ??= selectBackend();
  return (await backendPromise) === 'blobs' ? blobsStore : fileStore;
}

/* ----------------------------------------------------------- JSON helpers */

export async function readJson<T>(key: string): Promise<T | null> {
  const store = await getStore();
  const raw = await store.getText(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const store = await getStore();
  await store.setText(key, JSON.stringify(value));
}

export async function listKeys(prefix: string): Promise<string[]> {
  const store = await getStore();
  return store.list(prefix);
}

export async function deleteKey(key: string): Promise<void> {
  const store = await getStore();
  await store.remove(key);
}

export async function activeBackend(): Promise<StorageBackend> {
  return (await getStore()).backend;
}
