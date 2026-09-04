# CLAUDE.md — social-voting

## What this is

A single-purpose showcase web app for one lecture: attendees scan a QR code and submit one idea for an urban space, and the lecturer's projected screen groups those ideas with an LLM, expands the top three into image prompts and renders them as visualizations of the real site.

It is short-lived and rehearsed — no accounts, no anti-spam, no long-term persistence.

## Non-negotiable constraints

- **API key is client-only.** The lecturer's Google API key lives in their browser `localStorage` and nowhere else. Every Google Gen AI call is made from the browser. The key must never reach a Netlify Function, Netlify Blobs, a log line, an env file or a `VITE_*` variable.
- **Polish UI.** All user-facing text, and all LLM output (labels, syntheses), is Polish. Every string lives in `src/i18n/pl.ts` — never inline Polish copy elsewhere.
- **Netlify only.** Static site + Netlify Functions + Netlify Blobs on the free tier. No other backend services. Functions are a thin, key-less persistence layer.
- **`docs/` is local and authoritative.** `docs/01-project-description.md`, `docs/02-requirements.md` and `docs/03-implementation-plan.md` are the source of truth, and `docs/05-handoff.md` carries the current state, the decisions already taken and the traps already hit. **Read the handoff first**; it is shorter than the plan and says which parts of the plan turned out to be wrong. The folder is git-ignored on purpose — never commit it.
- **The build-order artifact is the other half of the handoff, and must be kept current.** <https://claude.ai/code/artifact/27973c5c-e885-4efc-89e3-f2731051e548> holds the dependency graph, the critical path, the item table and the risk list. Update it in the same session as the work, not afterwards: read it first (`action: "read"` with that URL), then publish back to the **same URL** so the link never changes. `docs/05-handoff.md` has a checklist of what to change there.
- **Windows host.** npm scripts must stay cross-platform; no bash-only syntax in `package.json`.

## Stack

Vite + React 18 + TypeScript (strict) + `react-router-dom` v6. `@netlify/functions` v2 API (`export default async (req, context) => Response` plus a `config` export with `path`), `@netlify/blobs`, `netlify-cli` as a dev dependency. `@google/genai`, `zod`, `qrcode.react`. Plain CSS with CSS variables — no Tailwind. ESLint + Prettier, Vitest.

## Scripts

`npm run dev` (netlify dev via npx) · `npm run dev:vite` (Vite only) · `npm run build` · `npm run preview` · `npm run typecheck` · `npm run lint` · `npm run format` · `npm test` · `npm run verify:models` · `npm run spike:grouping` · `npm run bench:grouping`

`netlify-cli` is intentionally not a dependency: it is 1186 packages and 277 MB, and Netlify installs devDependencies on every build.

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
- **Develop against `npx netlify-cli@23 dev --live`, not against deploys.** It tunnels the local `netlify dev` to a public `*.netlify.live` URL so phones can reach it, and costs no credits. The QR follows `window.location.origin`, so open the admin screen on the tunnel URL and it just works. It does not exercise the production build, real Blobs or deploy configuration, so the rehearsal still needs a real deploy.
- **A production deploy costs a flat 15 credits.** The free tier gives 300 a month, so the whole project has about 20 deploys in it, and roughly 6 were left as of the M3-2 deploy. Build speed does not affect this: the charge is per deploy, not per minute. The only lever is deploying less often, which is what the branch workflow below is for. Check the remaining balance before proposing a deploy.
- **Netlify credits are finite and the project must fit the free tier.** Work happens on `dev`; `main` is the production branch and mirrors what is deployed. Branch deploys and deploy previews are both off in the Netlify dashboard, so pushing `dev` costs nothing and keeps the work off the laptop. A deploy is a deliberate act: `git checkout main && git merge dev && git push`. `netlify.toml`'s `ignore` command also skips builds for test-only, script-only and docs-only commits, and `[skip netlify]` in a commit message skips one on demand. If credits still run short, **Build settings → Stopped builds** in the dashboard turns automatic builds off entirely; deploys then go through the CLI.
- Netlify shows a "Powered by Netlify" badge in the bottom-right corner by default. It is **turned off for this project in the Netlify dashboard**, so that corner is usable. If it ever reappears there, it will sit over the control bar's buttons and, later, over the gallery's third image.
