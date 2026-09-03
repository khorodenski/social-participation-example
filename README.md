# Social Voting — lecture idea-gathering & visualization demo

Attendees scan a QR code and post ideas for an urban space; the app groups them with an LLM, the lecturer selects three groups, expands them into image prompts and renders visualizations of the real site.

The project documentation (description, requirements, implementation plan) lives in `docs/`, which is intentionally git-ignored and local-only.

## Prerequisites

- Node.js 20 or newer (developed on Node 22).
- A Google AI Studio API key **for the lecturer only**. It is entered in the app's settings dialog and stored in that browser's `localStorage`. It is never committed, never put in an env file and never sent to the backend.

## Getting started

```
npm install
npm run dev
```

`npm run dev` runs `netlify dev` through `npx`, which serves the Vite app and the Netlify Functions together on one origin, so `/api/...` works locally. The first run downloads the Netlify CLI into the npx cache, which takes a minute; later runs reuse it.

The CLI is deliberately **not** a dependency of this project. It pulls 1186 packages and 277 MB, and Netlify installs devDependencies on every build, so keeping it out cuts each deploy's install from 1907 packages to 718.

Useful URLs once it is running:

- `/admin` — lecturer session list
- `/admin/<sessionId>` — lecturer stage screen
- `/s/<sessionId>` — attendee idea form
- `/api/health` — returns `{ ok: true, storage: "blobs" | "file" }`

## Scripts

| Script              | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | `netlify dev` via npx — app + functions     |
| `npm run dev:vite`  | Vite only, for UI work without functions    |
| `npm run build`     | Typecheck, then production build to `dist/` |
| `npm run preview`   | Serve the production build                  |
| `npm run typecheck` | `tsc --noEmit`                              |
| `npm run lint`      | ESLint                                      |
| `npm run format`    | Prettier, write mode                        |
| `npm test`          | Vitest, single run                          |

## Local storage backend

The functions store everything in a Netlify Blobs store named `social-voting`. When Blobs is not available — for example `netlify dev` without a linked site — `netlify/functions/_blobs.ts` falls back to a file-backed store under `.netlify/local-blobs/` (git-ignored) with the same interface. The functions log one line at startup saying which backend is active, and `/api/health` reports it too.

## Connecting to Netlify later

Nothing in this repository assumes a Netlify site id, team or deploy URL, so it builds and runs before any Netlify account exists. When you are ready:

1. Push this repository to GitHub.
2. In the Netlify UI, **Add new site → Import an existing project**, and pick the GitHub repository.
3. Leave the build settings alone — they are read from `netlify.toml` (`npm run build`, publish `dist`, functions in `netlify/functions`).
4. **No environment variables are required.** There are no secrets in the build; the Google API key lives only in the lecturer's browser.
5. Netlify Blobs is enabled by default for the site, so the functions switch from the local file backend to real Blobs automatically.
6. Deploy from `main`. Continuous deploys on every push to `main` after that.

## Staying inside the free tier

Netlify spends credits per build, and every push to `main` is a build. Three things keep that in check:

- **Push in batches, not per commit.** Commit as often as you like; push when you actually want a deploy to test against.
- **`netlify.toml` skips pointless builds.** Its `ignore` command compares the new commit against the last built one and skips the build when only tests, fixtures, `scripts/`, docs or tooling config changed.
- **Skip a single deploy on demand** by putting `[skip netlify]` in the commit message.

If credits still run short, turn off automatic builds in the Netlify UI (**Project configuration → Build & deploy → Stop builds**) and deploy by hand when you need one.
