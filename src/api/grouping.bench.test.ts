import { describe, expect, it } from 'vitest';
import { ModelError, groupIdeas } from './google';
import { makeIdeaLoad } from './__fixtures__/sampleIdeas';

/**
 * Latency benchmark for the grouping call.
 *
 * Where this landed, on gemma-4-26b-a4b-it with the scaled prompt:
 *
 *   1 idea    14.6 s      5 ideas    5.1 s      32 ideas   ~15 s
 *   2 ideas   9 s, measured in a browser on the live site
 *
 * gemma-4-31b-it is the slow fallback at 21 s, 89 s and 104 s for the same
 * sizes. Nothing here needs a model swap; grouping is an ordinary loading
 * state.
 *
 * The benchmark earned its keep twice over. It found that latency barely
 * tracks input size, and then that this model failed outright at 32 ideas on
 * a response shape the parser did not know. Run it after any prompt change:
 *
 *   $env:BENCH_SIZES="1,5,32"; npm run bench:grouping
 *
 * Skipped unless GOOGLE_API_KEY is set. It makes one real call per model per
 * size, so the default run is four calls and can take ten minutes. Results
 * print as they arrive, so an interrupted run still tells you something.
 *
 *   PowerShell:  $env:GOOGLE_API_KEY = Read-Host "key"; npm run bench:grouping
 *
 * Override the grid with BENCH_MODELS and BENCH_SIZES, both comma-separated.
 */
const apiKey = process.env.GOOGLE_API_KEY?.trim();

const MODELS = (process.env.BENCH_MODELS ?? 'gemma-4-31b-it,gemma-4-26b-a4b-it')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const SIZES = (process.env.BENCH_SIZES ?? '32,100')
  .split(',')
  .map((s) => Number.parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);

interface Row {
  model: string;
  ideas: number;
  seconds: number;
  groups: number | null;
  note: string;
}

const rows: Row[] = [];

/** Renders whatever generateJson attached, API error or schema failure. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`.replace(/\s+/g, ' ');
  if (typeof cause === 'string') return cause;

  try {
    return JSON.stringify(cause, null, 2);
  } catch {
    return String(cause);
  }
}

function report() {
  if (rows.length === 0) return;

  const header = ['model', 'ideas', 'seconds', 'groups', 'note'];
  const table = rows.map((row) => [
    row.model,
    String(row.ideas),
    row.seconds.toFixed(1),
    row.groups === null ? '-' : String(row.groups),
    row.note,
  ]);

  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...table.map((line) => (line[index] ?? '').length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ');

  console.log(
    `\nGrouping latency\n\n${line(header)}\n${line(widths.map((w) => '-'.repeat(w)))}\n${table
      .map(line)
      .join('\n')}\n`,
  );
}

describe.skipIf(!apiKey)('grouping latency', () => {
  for (const model of MODELS) {
    it(
      `times ${model} at ${SIZES.join(', ')} ideas`,
      async () => {
        for (const size of SIZES) {
          const ideas = makeIdeaLoad(size);
          const started = Date.now();

          try {
            const groups = await groupIdeas(apiKey as string, ideas, model);
            const seconds = (Date.now() - started) / 1000;

            const assigned = groups.flatMap((group) => group.ideaIds);
            const complete = new Set(assigned).size === size;

            rows.push({
              model,
              ideas: size,
              seconds,
              groups: groups.length,
              note: complete ? 'ok' : 'INCOMPLETE COVERAGE',
            });

            console.log(`  ${model} @ ${size}: ${seconds.toFixed(1)}s, ${groups.length} groups`);
          } catch (err) {
            const seconds = (Date.now() - started) / 1000;
            rows.push({
              model,
              ideas: size,
              seconds,
              groups: null,
              note: err instanceof Error ? err.message : String(err),
            });

            console.log(`  ${model} @ ${size}: FAILED after ${seconds.toFixed(1)}s`);

            // The Polish copy is for the lecturer. This is for whoever is
            // deciding whether the model is usable at all.
            if (err instanceof ModelError && err.cause !== undefined) {
              console.log(`    cause: ${describeCause(err.cause)}`);
            }
          }
        }

        report();
        // The benchmark measures; it does not judge. A failed call is still data.
        expect(rows.length).toBeGreaterThan(0);
      },
      15 * 60 * 1000,
    );
  }
});
