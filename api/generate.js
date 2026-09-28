/**
 * Vercel Function: /api/generate (free demo generations).
 *
 * MagicB is a static Vite build, so on Vercel the Vite preset serves dist/
 * and every file in the root api/ directory is deployed as a Node.js
 * function next to it (no Next.js needed). For projects that are not
 * Next.js, Vercel's Functions API reference documents the web-standard
 * signature used here:
 *
 *     export default { fetch(request) { return new Response(...) } }
 *
 * i.e. a Request in, a Response out, handling every HTTP method in one
 * export. It needs no @vercel/node types and lets tests call the handler
 * with plain Request objects. (The older `export default function
 * (req, res)` Node helper signature also works on Vercel but is not used.)
 *
 * Only this file lives in api/: helpers are in server/ so Vercel never
 * exposes them as routes. Its maxDuration is set in vercel.json.
 */
import { createDemoHandler } from '../server/demoHandler.js';

const handler = createDemoHandler();

export default {
    fetch(request) {
        return handler(request);
    }
};
