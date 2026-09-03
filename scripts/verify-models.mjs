/**
 * S-2 — confirm the model ids and probe the two Gemma unknowns.
 *
 * Run it from the repo root:
 *   node scripts/verify-models.mjs
 *
 * The key is read from GOOGLE_API_KEY, or asked for on stdin if that is unset.
 * It is never written to disk, never printed and never sent anywhere except
 * Google. Do not put it in a file in this repo.
 */
import { GoogleGenAI } from '@google/genai';
import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOOGLE_TS = path.join(ROOT, 'src', 'api', 'google.ts');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;

function heading(text) {
  console.log(`\n${bold(text)}\n${dim('─'.repeat(text.length))}`);
}

/** Reads the constants out of google.ts so we always test what the app ships. */
function readConstants() {
  const src = readFileSync(GOOGLE_TS, 'utf8');
  const grab = (name) => src.match(new RegExp(`${name}\\s*=\\s*'([^']+)'`))?.[1];
  return { textModel: grab('TEXT_MODEL'), imageModel: grab('IMAGE_MODEL') };
}

async function getKey() {
  if (process.env.GOOGLE_API_KEY?.trim()) return process.env.GOOGLE_API_KEY.trim();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const key = await rl.question('Google API key (not stored, not echoed to any file): ');
  rl.close();
  return key.trim();
}

function short(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\s+/g, ' ').slice(0, 220);
}

const { textModel, imageModel } = readConstants();

console.log(dim('\nsrc/api/google.ts says:'));
console.log(`  TEXT_MODEL  = ${bold(textModel ?? '?')}`);
console.log(`  IMAGE_MODEL = ${bold(imageModel ?? '?')}\n`);

const apiKey = await getKey();

if (!apiKey) {
  console.error(bad('\nNo key given. Nothing to do.'));
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

/* ------------------------------------------------------- 1. list models */

heading('1. Models this key can reach');

const available = [];
try {
  const pager = await ai.models.list();
  for await (const model of pager) {
    if (model.name) available.push(model);
  }
} catch (err) {
  console.error(bad(`  list() failed: ${short(err)}`));
  console.error(warn('  A 400/403 here usually means the key is wrong or the API is not enabled.'));
  process.exit(1);
}

const clean = (name) => name.replace(/^models\//, '');
const gemmas = available.filter((m) => /gemma/i.test(m.name));
const images = available.filter((m) => /image|banana/i.test(m.name));

console.log(`  ${available.length} models total.`);

console.log(`\n  ${bold('Gemma candidates for TEXT_MODEL:')}`);
if (gemmas.length === 0) {
  console.log(warn('    none — this key may not have Gemma access, or the family is named differently.'));
  console.log(dim('    Full list is printed at the end so you can pick by hand.'));
} else {
  for (const m of gemmas) {
    const hit = clean(m.name) === textModel ? ok('  <- current TEXT_MODEL') : '';
    console.log(`    ${clean(m.name).padEnd(34)} ${dim(m.displayName ?? '')}${hit}`);
  }
}

console.log(`\n  ${bold('Image-capable candidates for IMAGE_MODEL:')}`);
for (const m of images) {
  const hit = clean(m.name) === imageModel ? ok('  <- current IMAGE_MODEL') : '';
  console.log(`    ${clean(m.name).padEnd(34)} ${dim(m.displayName ?? '')}${hit}`);
}

const textListed = available.some((m) => clean(m.name) === textModel);
const imageListed = available.some((m) => clean(m.name) === imageModel);
console.log('');
console.log(`  TEXT_MODEL listed:  ${textListed ? ok('yes') : bad('NO')}`);
console.log(`  IMAGE_MODEL listed: ${imageListed ? ok('yes') : bad('NO')}`);

/* ------------------------------------------- 2. does the text model answer */

heading('2. Plain text call on TEXT_MODEL');

let textWorks = false;
try {
  const res = await ai.models.generateContent({
    model: textModel,
    contents: 'Odpowiedz jednym slowem: dziala?',
  });
  textWorks = Boolean(res.text);
  console.log(`  ${ok('OK')} — replied: ${JSON.stringify((res.text ?? '').slice(0, 80))}`);
} catch (err) {
  console.log(`  ${bad('FAILED')} — ${short(err)}`);
}

/* ------------------------------- 3. the two Gemma unknowns from the plan */

heading('3. Gemma capability probes (these shape the M3-1 prompt spike)');

if (!textWorks) {
  console.log(dim('  Skipped — the text model did not answer.'));
} else {
  // 3a. Is a real system role accepted?
  try {
    await ai.models.generateContent({
      model: textModel,
      contents: 'ping',
      config: { systemInstruction: 'Answer with the single word: pong.' },
    });
    console.log(`  systemInstruction: ${ok('accepted')} — you can use a real system prompt.`);
  } catch (err) {
    console.log(`  systemInstruction: ${warn('rejected')} — prepend the rules to the user turn instead.`);
    console.log(dim(`    ${short(err)}`));
  }

  // 3b. Is JSON response mode accepted?
  try {
    await ai.models.generateContent({
      model: textModel,
      contents: 'Return {"ok":true}',
      config: { responseMimeType: 'application/json' },
    });
    console.log(`  responseMimeType:  ${ok('accepted')} — structured output is available.`);
  } catch (err) {
    console.log(`  responseMimeType:  ${warn('rejected')} — the prompt must forbid prose and fences itself.`);
    console.log(dim(`    ${short(err)}`));
  }

  // 3c. Prompt-only JSON discipline, the way grouping will actually ask.
  const instruction = [
    'Zwroc WYLACZNIE jeden obiekt JSON, bez komentarzy i bez znacznikow markdown.',
    'Schemat: {"groups":[{"label":string,"synthesis":string,"ideaIds":string[]}]}',
    'Etykiety i syntezy po polsku.',
    '',
    'Pomysly:',
    'i1: wiecej drzew i cienia',
    'i2: lawki i stoly do pracy na zewnatrz',
    'i3: zielen, duzo zieleni',
  ].join('\n');

  try {
    const res = await ai.models.generateContent({ model: textModel, contents: instruction });
    const raw = (res.text ?? '').trim();
    const fenced = /^```/.test(raw);
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed = null;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      /* left null on purpose */
    }

    if (parsed && Array.isArray(parsed.groups)) {
      console.log(
        `  JSON discipline:   ${ok('good')}${fenced ? warn(' (wrapped in code fences — keep the strip-fences fallback)') : ''}`,
      );
      console.log(dim(`    got ${parsed.groups.length} group(s), first label: ${JSON.stringify(parsed.groups[0]?.label)}`));
    } else {
      console.log(`  JSON discipline:   ${bad('drifted')} — the prompt needs more work in M3-1.`);
      console.log(dim(`    ${raw.slice(0, 200)}`));
    }
  } catch (err) {
    console.log(`  JSON discipline:   ${bad('call failed')} — ${short(err)}`);
  }
}

/* ---------------------------------------------- 4. does the image model run */

heading('4. Image call on IMAGE_MODEL');

try {
  const res = await ai.models.generateContent({
    model: imageModel,
    contents: 'A small empty city square at golden hour, wide architectural photo.',
  });

  if (res.data) {
    const bytes = Math.round((res.data.length * 3) / 4 / 1024);
    console.log(`  ${ok('OK')} — got image data, about ${bytes} KB.`);
  } else {
    console.log(`  ${warn('No image')} — model replied with text instead: ${JSON.stringify((res.text ?? '').slice(0, 120))}`);
  }
} catch (err) {
  console.log(`  ${bad('FAILED')} — ${short(err)}`);
}

/* ------------------------------------------------------------- full list */

if (gemmas.length === 0) {
  heading('All model ids (pick TEXT_MODEL from here)');
  for (const m of available) console.log(`  ${clean(m.name)}`);
}

console.log(`\n${dim('S-2 is done when TEXT_MODEL is listed, section 2 says OK, and section 4 returns image data.')}\n`);
