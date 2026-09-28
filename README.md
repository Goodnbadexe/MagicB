# MagicB

MagicB is a command bar with a built-in AI website builder.

- **Jump anywhere:** type a shortcut (`yt`, `gh`, …) and press Enter.
- **Build a site:** describe it in plain language, e.g. `build a portfolio website for a photographer`. MagicB detects the language, theme and layout and generates a single-file HTML + Tailwind page. You can preview it in a sandboxed frame, copy it, download it, open it in a new window, and refine it through chat.

Built with React 19 and Vite 7. It deploys to Vercel with a small serverless function, or to GitHub Pages as a static build.

## AI modes

| Mode | When it is used | Who pays | Limits |
| --- | --- | --- | --- |
| **Free demo** (default on Vercel) | The visitor has not saved a key and `/api/generate` is available | The site owner (server-side `GEMINI_API_KEY`) | 5 generations per visitor IP per hour, plus a global daily cap. First drafts only. |
| **Bring your own key (BYO)** | The visitor saved a Gemini key in the key dialog (gear icon, or `config key AIza…`) | The visitor | Only the visitor's own Google quota. Includes chat refinements. |
| **Instant template** | No AI is available, or the demo returns 429/503 | Nobody | None. The page is built locally from the prompt analysis. |

- First-time visitors never see a key prompt. They start in demo mode, and the UI shows what is left ("Demo — 5 free generations left" on the start screen, `DEMO · 4 LEFT` in the builder).
- When the demo limit is reached (429) or the demo is unavailable (503), the preview falls back to the instant template. A notice explains why and opens the key dialog. After a key is saved, the same prompt is regenerated with it.
- A saved BYO key always takes precedence over the demo. It is stored in `localStorage` and sent **directly from the browser to Google** in the `x-goog-api-key` header. It never reaches the MagicB server.
- Refining a page sends the whole page back to the model, so refinement is a BYO-only feature.
- One model id is used everywhere: `DEFAULT_MODEL` in [`src/shared/gemini.js`](src/shared/gemini.js), currently `gemini-flash-latest`. This is the alias the official `@google/genai` SDK uses in its README, and it always points at Google's current Flash model. The server can pin a specific model with `GEMINI_MODEL`. (The previous `gemini-1.5-flash` has been retired.)

## Environment variables (Vercel)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | For the demo | – | The owner's Gemini API key, used only by `api/generate.js`. **If it is unset, the demo is off** (fail closed): the endpoint answers `503 {"demo":"unavailable"}` and visitors get BYO mode. |
| `GEMINI_MODEL` | No | `gemini-flash-latest` | Pins the server model, e.g. `gemini-3-flash-preview`. An invalid id disables the demo. |
| `ALLOWED_ORIGINS` | Recommended | – | Comma-separated origins allowed to call the demo, e.g. `https://magicb.goodnbad.info`. The deployment's own Vercel hostnames (`VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`) are always allowed. `http://localhost:*` is allowed except in production. |
| `DEMO_DAILY_CAP` | No | `50` | Global number of demo generations per UTC day, across all visitors. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Strongly recommended | – | Upstash Redis REST credentials (Vercel Marketplace, "Upstash for Redis"; formerly Vercel KV). They make the per-IP and daily counters global. If your integration exposes the credentials under other names (e.g. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), add these two with the same values. |

### How the demo is protected

The demo spends the owner's money, so `api/generate.js` (logic in [`server/demoHandler.js`](server/demoHandler.js)) applies these checks in order:

1. **Fail closed.** A missing key, invalid model, unreachable KV, or an upstream 401/403/429 all return `503 {"demo":"unavailable"}`.
2. **Origin allowlist.** A `POST` must carry an allowed `Origin` (or `Referer`). The sandboxed preview's `null` origin is rejected. This stops other websites from spending the quota through their visitors' browsers. It is **not** authentication, because scripts can forge headers. The limits below are what actually bound cost.
3. **Strict input.** The body must be JSON with exactly one field, `{"prompt": string}`, of 1–2000 characters, and at most 16 KiB. The server builds the full Gemini request itself.
4. **Per-IP rate limit.** Each visitor IP gets 5 generations per one-hour window. The IP is the first hop of `x-forwarded-for`, which Vercel overwrites so clients cannot spoof it. IPs are HMAC-hashed before they are used as counter keys.
5. **Global daily cap.** `DEMO_DAILY_CAP` limits generations per UTC day. Attempts are counted, not just successes.
6. **Bounded upstream call.** Output is capped at 8192 tokens. The call times out after 45 s (the function's `maxDuration` is 60 s). Upstream error bodies are logged server-side and never returned. Replies that are not an HTML document are refused, so the endpoint is not a general-purpose LLM proxy.

**Without KV**, counters live in each function instance's memory. They reset on cold start, and Vercel can run several instances at once. In this mode the daily cap is lowered to at most 20 per instance, but the true global total can still exceed `DEMO_DAILY_CAP`. Configure KV for a hard global cap. Whether or not KV is set, also set a budget or quota for the key in Google AI Studio / Google Cloud billing.

## Deploy to Vercel

1. In the Vercel dashboard, choose **Add New → Project** and import `Goodnbadexe/MagicB`. The **Vite** preset is detected. `vercel.json` supplies `npm ci`, `npm run build`, the `dist` output, the SPA rewrite (which skips `/api/*`), the function's `maxDuration`, and the security headers.
2. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` (Production). Optionally add `ALLOWED_ORIGINS`, `DEMO_DAILY_CAP` and `GEMINI_MODEL`. Leave the key out of Preview if preview deployments should not spend quota; they then run in BYO mode.
3. Recommended: under **Storage / Marketplace**, add **Upstash for Redis** and connect it to the project so `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set.
4. Deploy, or redeploy after any environment variable change. To check, open `https://<project>.vercel.app/api/generate`. It should return `{"demo":"available","limit":5,"remaining":5}`.

### Custom domain (e.g. `magicb.goodnbad.info`)

1. Go to **Project → Settings → Domains → Add** and enter `magicb.goodnbad.info`.
2. At the DNS host for `goodnbad.info`, create the record Vercel shows, normally a `CNAME` for `magicb` pointing to the target displayed in the dashboard. If `goodnbad.info` already uses Vercel nameservers, the record is created for you.
3. Add `https://magicb.goodnbad.info` to `ALLOWED_ORIGINS` and redeploy. (If it becomes the production domain, `VERCEL_PROJECT_PRODUCTION_URL` covers it too, but listing it explicitly is clearer.)

## GitHub Pages (static, BYO-key only)

`.github/workflows/deploy.yml` runs lint, tests and the build on every push to `main` and publishes to `https://goodnbadexe.github.io/MagicB/`:

```sh
GITHUB_PAGES=true npm run build   # base path /MagicB/
```

GitHub Pages has no serverless functions. That build compiles `__MAGICB_DEMO_API__ = false`, never calls `/api/generate`, and runs in BYO + instant-template mode. Other static hosts are detected at runtime: any answer from `/api/generate` other than JSON `{"demo":"available"}` switches to BYO mode. The headers in `vercel.json`, including CSP, do not apply on GitHub Pages.

## Security notes

- **Sandboxed previews.** Generated HTML is rendered in `<iframe sandbox="allow-scripts allow-forms allow-popups" srcdoc>` with no `allow-same-origin`. It gets an opaque origin, so it cannot read the app's storage (including a BYO key) or its DOM. See `PREVIEW_SANDBOX` in `src/utils/exportUtils.js`.
- **Headers** (in `vercel.json`): `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` plus `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that turns off camera, microphone, geolocation, payment and USB.
- **Why the CSP is not stricter.** A `srcdoc` frame, and the `about:blank` window behind **Open**, inherits the embedding page's CSP even though its origin is opaque. This was checked in Chromium: with `script-src 'self'`, the preview's Tailwind CDN script, Google Fonts stylesheet and inline scripts were all blocked. The policy therefore limits scripts to the app itself, the Tailwind CDN and inline scripts; limits `connect-src` to the app and the Gemini API (needed for BYO mode); blocks plugins and `<base>` hijacking; and allows the https styles, fonts, images, media and frames that generated pages use. A fully strict app CSP would require serving previews from a separate document with its own headers.

## Development

```sh
npm ci
npm run dev        # Vite dev server; /api is not served, so the app uses BYO/template mode
npm run lint
npm test           # Vitest unit tests for the demo endpoint (tests/)
npm run build      # Vercel build (base /)
npm run preview
```

To run the function locally, use the Vercel CLI: `vercel env pull` then `vercel dev`.

### Layout

```
api/generate.js          Vercel Function entry (web-standard `export default { fetch }`)
server/demoHandler.js    demo endpoint: validation, origin allowlist, limits, upstream call
server/counterStore.js   rate-limit counters: Upstash REST (fetch) or in-memory fallback
src/shared/gemini.js     DEFAULT_MODEL, system prompt and request helpers (client + server)
src/services/            AiService (BYO + demo calls), demoStatus (demo availability store)
src/features/Builder/    builder UI, parametric HTML generator, fallback notice
src/utils/               export helpers, local SVG placeholder images
tests/                   Vitest tests
legacy/                  old prebuilt bundle, kept for reference, not built or linted
```
