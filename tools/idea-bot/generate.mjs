/**
 * The working half of the idea bot: read a session, invent attendee ideas,
 * post them back. `server.mjs` is only the UI in front of this.
 *
 * Everything here runs on the lecturer's laptop and nothing is deployed —
 * `tools/` is outside `publish`, outside `functions` and outside the Vite
 * build. The Google key is passed in per call, never written to disk and never
 * printed, which is the same rule the app follows (CLAUDE.md).
 *
 * The three endpoints it uses are public and key-less, so the bot needs no
 * credentials of its own:
 *   GET  /api/sessions/<id>        the whole session, resources included
 *   GET  /api/assets/<key>         a resource photograph
 *   POST /api/sessions/<id>/ideas  one submission, only while stage=voting
 */
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GOOGLE_TS = path.join(ROOT, 'src', 'api', 'google.ts');

/** A failure with a Polish message the UI can show as-is, plus an HTTP status. */
export class BotError extends Error {
  constructor(message, status = 400, options) {
    super(message, options);
    this.name = 'BotError';
    this.status = status;
  }
}

/**
 * Reads TEXT_MODEL out of `src/api/google.ts`, the same trick
 * `scripts/verify-models.mjs` uses, so the bot always talks to the model the
 * app ships. No fallback on purpose: a silently wrong model would make a test
 * run prove nothing.
 */
export function textModel() {
  const src = readFileSync(GOOGLE_TS, 'utf8');
  const found = src.match(/TEXT_MODEL\s*=\s*'([^']+)'/)?.[1];
  if (!found) throw new BotError('Nie mogę odczytać TEXT_MODEL z src/api/google.ts.', 500);
  return found;
}

/* --------------------------------------------------------------- the link */

/**
 * Pulls the origin and the session id out of whatever the lecturer pasted:
 * the attendee link `/s/<id>`, the lecturer's `/admin/<id>`, or the raw
 * `/api/sessions/<id>`.
 */
export function parseTarget(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new BotError('Wklej link do sesji.');

  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw);
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `${local ? 'http' : 'https'}://${raw}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new BotError('To nie wygląda na poprawny adres.');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const marker = segments.findIndex((s) => s === 's' || s === 'admin' || s === 'sessions');
  const sessionId = marker === -1 ? segments[0] : segments[marker + 1];

  if (!sessionId || !/^[a-z0-9-]{3,40}$/i.test(sessionId)) {
    throw new BotError('Nie znalazłem identyfikatora sesji w tym linku.');
  }

  return { origin: url.origin, sessionId };
}

/* ------------------------------------------------------------ the session */

async function callApi(origin, endpoint, init = {}) {
  let res;
  try {
    res = await fetch(`${origin}${endpoint}`, init);
  } catch (err) {
    throw new BotError(`Nie mogę się połączyć z ${origin}. Sprawdź adres i sieć.`, 502, {
      cause: err,
    });
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // Our own functions always answer { "error": "<polish>" }, so their message
    // is better than anything this file could invent.
    const message =
      typeof body?.error === 'string' ? body.error : `Serwer odpowiedział błędem ${res.status}.`;
    throw new BotError(message, res.status);
  }

  return body;
}

export async function fetchSession(origin, sessionId) {
  const session = await callApi(origin, `/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!session || typeof session.id !== 'string') {
    throw new BotError('Spod tego adresu nie przyszła sesja.', 502);
  }
  return session;
}

/** Photographs are optional context, so a missing one is skipped, not fatal. */
const MAX_IMAGES = 3;

/**
 * Downloads the resource photographs the model should see.
 *
 * Prefers `previewKey` over `imageKey` for the same reason expansion does: the
 * small copy is about a seventh of the tokens and this call does not need
 * 2048 px to know what the place looks like.
 *
 * `cache` is a plain Map owned by the caller. The server process lives for one
 * test session, so there is no expiry — restart it if a photograph changes.
 */
export async function fetchReferenceImages(origin, session, cache = new Map()) {
  const wanted = (session.resources ?? [])
    .filter((r) => r.type === 'image')
    .map((r) => ({ description: r.description ?? '', key: r.previewKey || r.imageKey }))
    .filter((r) => typeof r.key === 'string' && r.key.length > 0)
    .slice(0, MAX_IMAGES);

  const images = [];

  for (const item of wanted) {
    const cacheKey = `${origin}|${item.key}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      images.push({ ...cached, description: item.description });
      continue;
    }

    try {
      const res = await fetch(`${origin}/api/assets/${item.key}`);
      if (!res.ok) continue;

      const bytes = Buffer.from(await res.arrayBuffer());
      const entry = {
        mimeType: res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg',
        data: bytes.toString('base64'),
      };

      cache.set(cacheKey, entry);
      images.push({ ...entry, description: item.description });
    } catch {
      /* A photograph that will not download is not worth failing the run over. */
    }
  }

  return images;
}

/* ---------------------------------------------------------- the generator */

/**
 * Written against `src/api/__fixtures__/sampleIdeas.ts`, which is what real
 * submissions looked like in the rehearsal. The messiness is the point: a
 * clean, uniform list would let grouping look better than it is.
 */
const IDEA_SYSTEM_PROMPT = `Jesteś generatorem materiału testowego dla aplikacji warsztatowej. Udajesz uczestników spotkania, którzy na telefonie, w pośpiechu, wpisują swój pomysł na zagospodarowanie jednego konkretnego miejsca w mieście.

CO PISZESZ
- Każdy pomysł to jedno zgłoszenie jednej osoby. Od 1 do 3 zdań, po polsku.
- Trzymaj się miejsca opisanego przez lektora: tytułu, wprowadzenia, notatek i zdjęć. Pomysły mają dotyczyć tego miejsca, nie miasta w ogóle.
- Pisz konkretnie: co miałoby tu powstać albo zniknąć. Nie pisz esejów i nie uzasadniaj po trzy zdania.

RÓŻNORODNOŚĆ — TO NAJWAŻNIEJSZE
- Mieszaj długości. Większość zgłoszeń ma od 4 do 20 słów. Kilka jest dłuższych, na dwa zdania.
- Część to same równoważniki zdań, bez czasownika, na przykład "wiecej lawek i cien".
- Mniej więcej co piąte zgłoszenie pisz niechlujnie: mała litera na początku, literówka, brak polskich znaków, brak kropki na końcu. Nie rób tego w każdym, bo to też byłoby jednostajne.
- Mniej więcej co dziesiąte zgłoszenie niech nie będzie propozycją dla przestrzeni: sama skarga, komentarz o cenach, rozkładach albo o urzędzie. Aplikacja ma je zebrać osobno i musi mieć na czym to sprawdzić.
- Jeśli prosimy o 15 lub więcej pomysłów, dokładnie jeden z nich niech zawiera imię albo podpis, na przykład "pozdrawiam, Marek". Aplikacja usuwa takie rzeczy z syntezy i to też trzeba przetestować.
- Pomysły mają się układać w kilka naturalnych tematów, ale nie równo po tyle samo na temat. Kilka niech będzie pojedynczych i osobnych.

CZEGO NIE ROBISZ
- Bez numerowania, bez myślników na początku, bez cudzysłowów, bez markdown, bez emoji.
- Nie powtarzaj i nie parafrazuj pomysłów wymienionych jako już wygenerowane.
- Nie pisz o sobie, o modelu ani o teście. Piszesz jako uczestnik.
- Każde zgłoszenie ma co najmniej 15 znaków i najwyżej 300.

FORMAT
Zwróć wyłącznie jeden obiekt JSON o tej strukturze:
{"ideas":["tekst zgłoszenia","tekst zgłoszenia"]}
Bez tekstu przed i po, bez komentarzy, bez znaczników markdown.`;

function buildUserParts(session, images, count, hint, existing) {
  const head = ['MIEJSCE I PYTANIE DO UCZESTNIKÓW', `Tytuł sesji: ${session.title}`];

  if (session.intro?.trim())
    head.push(`Wprowadzenie pokazywane uczestnikom: ${session.intro.trim()}`);

  const notes = (session.resources ?? []).filter((r) => r.type === 'text' && r.text?.trim());
  if (notes.length > 0) {
    head.push('', 'NOTATKI LEKTORA O TYM MIEJSCU');
    for (const note of notes) {
      head.push(`- ${note.description?.trim() || 'Notatka'}: ${note.text.trim()}`);
    }
  }

  if (images.length > 0) {
    head.push('', `ZDJĘCIA MIEJSCA: ${images.length}. Każde poniżej, razem ze swoim opisem.`);
  }

  const parts = [{ text: head.join('\n') }];

  for (const image of images) {
    parts.push({ text: `Zdjęcie — ${image.description.trim() || 'bez opisu'}:` });
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  const tail = [];
  if (hint?.trim()) tail.push(`DODATKOWA WSKAZÓWKA OD LEKTORA: ${hint.trim()}`, '');

  if (existing.length > 0) {
    tail.push('JUŻ WYGENEROWANE — nie powtarzaj ich ani nie parafrazuj:');
    for (const text of existing) tail.push(`- ${text}`);
    tail.push('');
  }

  tail.push(`Napisz teraz ${count} nowych zgłoszeń. Zwróć tylko JSON.`);
  parts.push({ text: tail.join('\n') });

  return parts;
}

/** An API key must never end up in a message that gets rendered or logged. */
function redact(text) {
  return text.replace(/AIza[0-9A-Za-z_-]{10,}/g, '***');
}

/** Same failure map as `describeModelError` in src/api/google.ts, in Polish. */
function describeError(err) {
  const raw = redact(err instanceof Error ? err.message : String(err));

  if (/\b(401|403)\b|API[_ ]?key|permission/i.test(raw)) return 'Klucz API został odrzucony.';
  if (/\b429\b|quota|rate limit|RESOURCE_EXHAUSTED/i.test(raw)) return 'Limit zapytań wyczerpany.';
  if (/safety|blocked|PROHIBITED_CONTENT|RECITATION/i.test(raw))
    return 'Model zablokował odpowiedź.';
  if (/fetch|network|ENOTFOUND|ECONNRESET|timeout/i.test(raw))
    return 'Nie udało się połączyć z Google.';

  return `Model odpowiedział błędem: ${raw.slice(0, 200)}`;
}

/** Reads the ideas out of a reply, behind the same fallbacks as the app. */
function extractIdeas(raw) {
  if (!raw) return [];

  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed = null;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    const start = unfenced.search(/[[{]/);
    const end = Math.max(unfenced.lastIndexOf(']'), unfenced.lastIndexOf('}'));
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        return [];
      }
    }
  }

  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.ideas) ? parsed.ideas : [];

  return list
    .map((item) =>
      typeof item === 'string' ? item : typeof item?.text === 'string' ? item.text : '',
    )
    .filter((text) => text.length > 0);
}

/** The app trims and then demands 10..1000 characters — see `ideaTextSchema`. */
const MIN_LENGTH = 10;
const MAX_LENGTH = 1000;

function tidy(text) {
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/^[-–—*]\s*/, '')
    .replace(/^["'„”]+|["'„”]+$/g, '')
    .trim();

  if (clean.length < MIN_LENGTH) return null;
  return clean.slice(0, MAX_LENGTH);
}

async function callModel(ai, model, session, images, count, hint, existing) {
  let problem = 'Model odpowiedział w formacie, którego nie rozumiem.';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: buildUserParts(session, images, count, hint, existing) }],
        config: {
          systemInstruction: IDEA_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          // High on purpose, and the opposite of the app's grouping call:
          // here sameness is the bug, not the goal.
          temperature: attempt === 0 ? 1.15 : 1,
        },
      });

      const ideas = extractIdeas(res.text);
      if (ideas.length > 0) return ideas;

      problem = 'Model nie zwrócił listy pomysłów.';
    } catch (err) {
      problem = describeError(err);
    }
  }

  throw new BotError(problem, 502);
}

/**
 * Asking for 40 ideas in one call gets 40 variations on the same five
 * sentences, so they come in small batches with the earlier ones listed as
 * "already written". Duplicates are dropped here rather than trusted away.
 */
const BATCH = 15;
const MAX_ROUNDS = 8;

export async function generateIdeas({ apiKey, session, images, count, hint, onProgress }) {
  const ai = new GoogleGenAI({ apiKey });
  const model = textModel();

  const ideas = [];
  const seen = new Set();

  for (let round = 0; round < MAX_ROUNDS && ideas.length < count; round += 1) {
    const want = Math.min(BATCH, count - ideas.length);
    const batch = await callModel(ai, model, session, images, want, hint, ideas);

    let added = 0;
    for (const raw of batch) {
      const text = tidy(raw);
      if (!text) continue;

      const fingerprint = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
      if (seen.has(fingerprint)) continue;

      seen.add(fingerprint);
      ideas.push(text);
      added += 1;

      if (ideas.length === count) break;
    }

    onProgress?.(ideas.length, count);

    // A round that adds nothing means the model has run out of things to say.
    // Another round would burn a minute for the same answer.
    if (added === 0) break;
  }

  if (ideas.length === 0) throw new BotError('Model nie zwrócił ani jednego pomysłu.', 502);

  return ideas;
}

/* ------------------------------------------------------------- the sender */

/** Gentle on purpose: there is no anti-spam to trip, but no reason to hammer. */
const CONCURRENCY = 4;

/**
 * Posts each text as its own submission and reports per idea.
 *
 * A rejection is not thrown: the usual one is 409 "nie trwa zbieranie", which
 * fails every idea for one reason, and the lecturer should see that reason on
 * the row rather than as a dead page.
 */
export async function submitIdeas(origin, sessionId, texts, onProgress) {
  const endpoint = `/api/sessions/${encodeURIComponent(sessionId)}/ideas`;
  const results = new Array(texts.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < texts.length) {
      const index = cursor;
      cursor += 1;

      const text = texts[index];
      try {
        const body = await callApi(origin, endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        results[index] = { text, ok: true, id: body?.id ?? null };
      } catch (err) {
        results[index] = {
          text,
          ok: false,
          error: err instanceof BotError ? err.message : 'Nie udało się wysłać.',
        };
      }

      done += 1;
      onProgress?.(done, texts.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, texts.length) }, worker));

  return results;
}
