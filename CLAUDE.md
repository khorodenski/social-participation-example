# CLAUDE.md — social-voting

## What this is

A single-purpose showcase web app for one lecture: attendees scan a QR code and submit one idea for an urban space, and the lecturer's projected screen groups those ideas with an LLM, expands the top three into image prompts and renders them as visualizations of the real site.

It is short-lived and rehearsed — no accounts, no anti-spam, no long-term persistence.

## Non-negotiable constraints

- **API key is client-only.** The lecturer's Google API key lives in their browser `localStorage` and nowhere else. Every Google Gen AI call is made from the browser. The key must never reach a Netlify Function, Netlify Blobs, a log line, an env file or a `VITE_*` variable.
- **Polish UI.** All user-facing text, and all LLM output (labels, syntheses), is Polish. Every string lives in `src/i18n/pl.ts` — never inline Polish copy elsewhere.
- **Netlify only.** Static site + Netlify Functions + Netlify Blobs on the free tier. No other backend services. Functions are a thin, key-less persistence layer.
- **`docs/` is local and authoritative.** `docs/01-project-description.md`, `docs/02-requirements.md` and `docs/03-implementation-plan.md` are the source of truth. The folder is git-ignored on purpose — never commit it, and read it before making design decisions.
- **Windows host.** npm scripts must stay cross-platform; no bash-only syntax in `package.json`.

## Stack

Vite + React 18 + TypeScript (strict) + `react-router-dom` v6. `@netlify/functions` v2 API (`export default async (req, context) => Response` plus a `config` export with `path`), `@netlify/blobs`, `netlify-cli` as a dev dependency. `@google/genai`, `zod`, `qrcode.react`. Plain CSS with CSS variables — no Tailwind. ESLint + Prettier, Vitest.

## Scripts

`npm run dev` (netlify dev) · `npm run dev:vite` (Vite only) · `npm run build` · `npm run preview` · `npm run typecheck` · `npm run lint` · `npm run format` · `npm test`

## Where things live

| Thing                                   | File                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Model ids (`TEXT_MODEL`, `IMAGE_MODEL`) | `src/api/google.ts` — the only place they appear                              |
| All UI strings                          | `src/i18n/pl.ts`                                                              |
| System prompts + response schemas       | `src/api/prompts.ts`                                                          |
| Session types and zod schemas           | `src/state/session.ts`                                                        |
| API key storage                         | `src/state/settings.ts` — the only module touching `localStorage` for the key |
| Function fetch wrappers                 | `src/api/client.ts`                                                           |
| Blobs helper + local file fallback      | `netlify/functions/_blobs.ts`                                                 |

## Conventions

- Functions route via `config.path`, not via `netlify.toml` redirects. `netlify.toml` has only the SPA fallback.
- All JSON errors from functions are `{ "error": "<polish message>" }`, using strings from `src/i18n/pl.ts`.
- One blob per idea (`sessions/<id>/ideas/<ideaId>.json`) so concurrent attendee writes never race.
- Every model response is zod-validated before it is persisted; invalid responses surface as a retryable error.
