/**
 * The idea bot's local web UI.
 *
 * Start it from the repo root:
 *   npm run tester
 *
 * It listens on http://localhost:5180 and opens a page where the lecturer
 * pastes a session link, generates attendee ideas and sends them in.
 *
 * Why a local server and not a plain HTML file: the Netlify Functions send no
 * CORS headers, so a page served from anywhere other than the site itself
 * cannot read their answers. This process does the fetching instead, and the
 * browser only ever talks to localhost.
 *
 * Nothing here is deployed. `tools/` is outside `publish`, outside `functions`
 * and outside the Vite build.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  BotError,
  fetchReferenceImages,
  fetchSession,
  generateIdeas,
  parseTarget,
  submitIdeas,
  textModel,
} from './generate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, 'index.html');

const PORT = Number(process.env.PORT) || 5180;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_COUNT = 60;

/** Photographs, keyed by asset URL, so a second run does not re-download them. */
const imageCache = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new BotError('Za dużo danych naraz.', 413);
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BotError('Nie rozumiem tego żądania.', 400);
  }
}

/** What the page shows about a session before anything is generated. */
function describeSession(session, images) {
  return {
    id: session.id,
    title: session.title,
    intro: session.intro ?? '',
    stage: session.stage,
    resources: (session.resources ?? []).map((resource) => ({
      type: resource.type,
      description: resource.description ?? '',
      chars: resource.type === 'text' ? (resource.text ?? '').length : 0,
      useAsReference: Boolean(resource.useAsReference),
    })),
    images: images.length,
  };
}

/* ------------------------------------------------------------ the routes */

async function inspect(body) {
  const { origin, sessionId } = parseTarget(body.target);
  const session = await fetchSession(origin, sessionId);
  const images = await fetchReferenceImages(origin, session, imageCache);

  return {
    origin,
    session: describeSession(session, images),
    model: textModel(),
  };
}

async function generate(body) {
  const apiKey = String(body.apiKey ?? '').trim();
  if (!apiKey) throw new BotError('Podaj klucz Google API.', 400);

  const count = Math.floor(Number(body.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_COUNT) {
    throw new BotError(`Liczba pomysłów musi być od 1 do ${MAX_COUNT}.`, 400);
  }

  const { origin, sessionId } = parseTarget(body.target);
  const session = await fetchSession(origin, sessionId);
  const images = await fetchReferenceImages(origin, session, imageCache);

  const startedAt = Date.now();
  console.log(`generuję ${count} pomysłów dla ${sessionId} (${images.length} zdjęć)…`);

  const ideas = await generateIdeas({
    apiKey,
    session,
    images,
    count,
    hint: String(body.hint ?? ''),
    onProgress: (made, wanted) => console.log(`  ${made}/${wanted}`),
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`gotowe: ${ideas.length} pomysłów w ${seconds}s`);

  return { ideas, seconds: Number(seconds), stage: session.stage };
}

async function submit(body) {
  const texts = Array.isArray(body.texts)
    ? body.texts.map((text) => String(text ?? '').trim()).filter((text) => text.length > 0)
    : [];

  if (texts.length === 0) throw new BotError('Nie ma czego wysłać.', 400);
  if (texts.length > MAX_COUNT) throw new BotError(`Najwyżej ${MAX_COUNT} naraz.`, 400);

  const { origin, sessionId } = parseTarget(body.target);
  console.log(`wysyłam ${texts.length} pomysłów do ${sessionId}…`);

  const results = await submitIdeas(origin, sessionId, texts);
  const sent = results.filter((result) => result.ok).length;
  console.log(`wysłane: ${sent}/${results.length}`);

  return { results, sent };
}

const ROUTES = { '/inspect': inspect, '/generate': generate, '/submit': submit };

/* ------------------------------------------------------------ the server */

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      // Read on every request so editing the page only needs a browser reload.
      const html = await readFile(PAGE);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(html);
      return;
    }

    const route = ROUTES[url.pathname];

    if (!route) return json(res, 404, { error: 'Nie ma tu nic pod tym adresem.' });
    if (req.method !== 'POST') return json(res, 405, { error: 'Zła metoda.' });

    try {
      json(res, 200, await route(await readBody(req)));
    } catch (err) {
      if (err instanceof BotError) {
        console.error(`błąd ${err.status}: ${err.message}`);
        return json(res, err.status, { error: err.message });
      }

      // Never print the error object itself: a key could be inside it.
      console.error('nieoczekiwany błąd:', err instanceof Error ? err.name : typeof err);
      json(res, 500, { error: 'Coś poszło nie tak po stronie narzędzia.' });
    }
  })();
});

/** Convenience only — the URL is printed either way. */
function open(target) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', target]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];

  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* No browser to open is not a reason to stop. */
  }
}

server.listen(PORT, '127.0.0.1', () => {
  const address = `http://localhost:${PORT}`;
  console.log(`\nGenerator pomysłów testowych: ${address}`);
  console.log(`Model tekstowy: ${textModel()}`);
  console.log('Zatrzymaj: Ctrl+C\n');

  if (!process.argv.includes('--no-open')) open(address);
});
