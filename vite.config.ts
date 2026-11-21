// vite.config.ts — build settings, plus the /api/headline endpoint for
// `npm run dev` and `vite preview`. `base: './'` makes dist/ work from any
// sub-folder (GitHub Pages serves from /<repo>/).
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { handleHeadline } from './server/headline.ts';

/** Turns a Node request into a web Request, runs the handler, writes the Response back. */
async function serveHeadline(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request('http://localhost/api/headline', {
    method: req.method ?? 'GET',
    headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
    body: hasBody ? Buffer.concat(chunks) : null,
  });
  const response = await handleHeadline(request);
  res.statusCode = response.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(await response.text());
}

/** Serves /api/headline from the Vite dev and preview servers (on Netlify, a Function does it). */
function headlineApi(): Plugin {
  // Load .env into process.env; variables already set in the shell win. Values are never logged.
  if (existsSync('.env')) process.loadEnvFile('.env');
  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    void serveHeadline(req, res);
  };
  return {
    name: 'headline-api',
    // Block bodies on purpose: a hook that *returns* a function is treated by Vite as a post-hook.
    configureServer(server) {
      server.middlewares.use('/api/headline', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/headline', handler);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [headlineApi()],
  build: { chunkSizeWarningLimit: 1000 }, // three.js alone is ~700 kB
  test: { include: ['tests/**/*.test.ts'] },
});
