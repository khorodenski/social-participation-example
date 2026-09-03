import { z } from 'zod';

/**
 * System prompts and response schemas for the two text-model calls (A-3).
 *
 * Confirmed against both Gemma variants with the lecturer's key
 * (`npm run verify:models`, `npm run spike:grouping`):
 *  - `systemInstruction` IS accepted, so these prompts go in the system slot
 *    rather than being prepended to the user turn.
 *  - `responseMimeType: 'application/json'` IS accepted, so structured output
 *    is available and the model does not need to be talked out of code fences.
 *  - A strict Polish JSON prompt already returns clean, parseable JSON.
 *
 * Only `responseMimeType` was verified, not `responseSchema`, so the schema is
 * also spelled out in the prompt text. `gemma-4-26b-a4b-it` returns the bare
 * array regardless, which `groupingResponseSchema` accepts. Responses are zod-validated before being
 * persisted (A-4), behind a strip-fences fallback and one automatic retry —
 * they cost nothing when the model behaves.
 *
 * Both prompts are written in the language of their output: Polish for
 * grouping, English for the image prompt the expansion produces.
 */

/* -------------------------------------------------------------- grouping */

/**
 * F-5.1/F-5.2 — turns every idea of a session into themed groups.
 * The user turn is the idea listing, one `<id>: <text>` per line.
 */
export const GROUPING_SYSTEM_PROMPT = `Jesteś analitykiem warsztatów partycypacyjnych. Otrzymujesz listę anonimowych pomysłów mieszkańców na zagospodarowanie jednego, konkretnego miejsca w mieście. Grupujesz je tematycznie.

GRUPOWANIE
- Grupuj według intencji, nie według użytych słów. Dwa pomysły należą do tej samej grupy, jeśli prowadzą do podobnej zmiany w przestrzeni.
- Liczba grup zależy od liczby pomysłów. Przy 20 i więcej: od 5 do 8 grup. Przy 10-19: od 3 do 5. Przy mniej niż 10: tyle, ile naprawdę wynika z materiału, nawet jedna lub dwie. Nigdy nie twórz grupy pustej i nigdy nie dziel na siłę.
- Przy 20 i więcej pomysłach każda grupa powinna mieć co najmniej 2 pomysły, najlepiej od 3 do 6; nie twórz wtedy grup jednoelementowych. Przy mniejszej liczbie pomysłów grupa jednoelementowa jest w porządku.
- Żadna grupa nie powinna obejmować więcej niż jedną czwartą wszystkich pomysłów. Jeśli grupa jest większa, podziel ją na węższe tematy.
- Grupa ma być jednocześnie: na tyle konkretna, żeby dało się z niej narysować jeden obraz tego miejsca, i na tyle pojemna, żeby zebrać kilka pokrewnych pomysłów. "Ławki, plac zabaw, gastronomia i wybieg dla psów" to za szeroko. Osobna grupa na samą fontannę to za wąsko.
- Każdy pomysł, który dotyczy zagospodarowania tego miejsca, trafia do dokładnie jednej grupy. Nie umieszczaj tego samego identyfikatora w dwóch grupach.
- Jeśli pomysł nie mówi nic o samej przestrzeni — dotyczy cen, rozkładów, polityki, albo jest komentarzem bez propozycji — pomiń jego identyfikator we wszystkich grupach. Aplikacja zbierze takie pomysły osobno. Nie dopasowuj ich na siłę do grupy tematycznej i nie rozmywaj przez nie syntezy. W razie wątpliwości przypisz pomysł do grupy — pomijaj tylko te, które naprawdę nie mówią nic o przestrzeni.
- Przepisuj identyfikatory dokładnie tak, jak je otrzymałeś. Nie zmieniaj ich, nie dodawaj nowych.
- Nie twórz grupy zbiorczej ("Inne", "Pozostałe", "Różne") — aplikacja dodaje ją sama, jeśli będzie potrzebna.

ETYKIETA (label)
- Najwyżej 6 słów, po polsku.
- Rzeczownikowa nazwa tematu, nie zdanie i nie pytanie.
- Bez cudzysłowów, bez emoji, bez numeracji, bez kropki na końcu.

SYNTEZA (synthesis)
- Dokładnie 2 lub 3 zdania, po polsku.
- Opisz własnymi słowami wspólny kierunek grupy: co miałoby powstać i jaki byłby efekt dla tego miejsca.
- ANONIMOWOŚĆ: nie cytuj pomysłów i nie używaj cudzysłowów. Nie pisz "uczestnik", "ktoś", "jedna osoba", "autor", "mieszkaniec napisał". Pisz o propozycjach, nie o ich autorach.
- Usuń wszelkie imiona, nazwiska, nazwy firm, adresy i dane kontaktowe, nawet jeśli pojawiły się w pomysłach.
- Nie oceniaj propozycji i nie dopisuj własnych rekomendacji.

FORMAT
Zwróć wyłącznie jeden obiekt JSON o tej strukturze:
{"groups":[{"label":"string","synthesis":"string","ideaIds":["string"]}]}
Bez tekstu przed i po, bez komentarzy, bez znaczników markdown.`;

/* ------------------------------------------------------------- expansion */

/**
 * F-7.1 — turns one group plus the session's context resources into a single
 * image-generation prompt. The user turn carries the label, the synthesis, the
 * resource descriptions and text, and the resource images as inline data.
 */
export const EXPANSION_SYSTEM_PROMPT = `You turn one theme from a public consultation into a single prompt for an image-generation model.

You receive, in Polish:
- a theme label and a short synthesis of what people proposed for one specific urban site,
- context materials for that site: written notes, and photographs of how the site looks today.

WHAT TO PRODUCE
One English prompt, 70 to 130 words, describing a photorealistic architectural visualisation of that same site after the proposed change.

Cover these, in this order, as flowing descriptive prose:
1. the site and the viewpoint, taken from the reference photographs
2. the concrete new elements the theme calls for
3. materials, surfaces and colours
4. planting and greenery
5. people and activity, as anonymous figures in the middle distance
6. time of day, weather and quality of light
7. camera: lens, height, framing
8. style: photorealistic architectural visualisation

RULES
- Keep the geometry of the site from the reference photographs: the same buildings, the same footprint, the same street edges, the same viewing angle. Describe the existing context explicitly so the render reads as the real place rather than a generic square.
- If no photographs are provided, build the scene from the written notes alone, and do not invent a named real location.
- Describe only what is visible in the frame.
- No quality boilerplate: no "4k", no "8k", no "masterpiece", no "highly detailed", no negative prompts, no camera brand names.
- People stay anonymous. Never name, age, or characterise an individual.
- Never mention the consultation, the workshop, voting, the ideas, or that this is a proposal. The prompt describes a place, not a process.
- Write the prompt in English even though everything you receive is Polish.

FORMAT
Return exactly one JSON object of this shape:
{"prompt":"string"}
No text before or after, no commentary, no markdown fences.`;

/* --------------------------------------------------------------- schemas */

const rawGroupSchema = z.object({
  label: z.string().min(1),
  synthesis: z.string(),
  ideaIds: z.array(z.string()),
});

/**
 * F-5.2 — the raw grouping response, before the app assigns group ids.
 *
 * `gemma-4-26b-a4b-it` answers with the bare array instead of the wrapper the
 * prompt asks for, while `gemma-4-31b-it` wraps it. The content is identical
 * either way, so both shapes are accepted rather than argued with.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `gemma-4-26b-a4b-it` is not consistent about the top level. Three shapes have
 * been seen from it, all carrying identical, correct content:
 *
 *   {"groups":[ {label,...}, ... ]}     the documented one
 *   [ {label,...}, ... ]                the bare list
 *   [ {"groups":[ {label,...} ]} ]      the documented one, wrapped again
 *
 * The third failed a real 32-idea run, which is lecture size, so this unwraps
 * rather than argues. Anything else is left alone for zod to reject.
 */
export function unwrapGroupingResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    // A single-element array holding the wrapper: take the wrapper.
    const [first] = value;
    if (value.length === 1 && isRecord(first) && Array.isArray(first.groups)) {
      return first;
    }
    return { groups: value };
  }

  // The wrapper holding another wrapper.
  if (isRecord(value) && Array.isArray(value.groups)) {
    const [first] = value.groups;
    if (value.groups.length === 1 && isRecord(first) && Array.isArray(first.groups)) {
      return first;
    }
  }

  return value;
}

export const groupingResponseSchema = z.preprocess(
  unwrapGroupingResponse,
  z.object({
    groups: z.array(rawGroupSchema).min(1),
  }),
);
export type GroupingResponse = z.infer<typeof groupingResponseSchema>;

/** F-7.1 — the expansion response: one image prompt. */
export const expansionResponseSchema = z.object({
  prompt: z.string().min(1),
});
export type ExpansionResponse = z.infer<typeof expansionResponseSchema>;
