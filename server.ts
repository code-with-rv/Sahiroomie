import fs from 'fs';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachLiveVoiceBridge } from './src/liveVoiceBridge.js';
import { createSahiroomieApp, injectRouteSeoIntoHtml } from './src/serverApp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createSahiroomieApp();

function isHtmlPageRoute(reqPath: string): boolean {
  if (
    reqPath.startsWith('/api/') ||
    reqPath.startsWith('/@') ||
    reqPath.startsWith('/src/') ||
    reqPath.startsWith('/node_modules/')
  ) {
    return false;
  }
  return !path.extname(reqPath);
}

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const server = http.createServer(app);
  attachLiveVoiceBridge(server);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server,
          path: '/__vite_hmr',
        },
      },
      appType: 'spa',
    });

    app.get('*', async (req, res, next) => {
      if (!isHtmlPageRoute(req.path) || !req.headers.accept?.includes('text/html')) {
        return next();
      }
      try {
        const rawHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const seoHtml = injectRouteSeoIntoHtml(rawHtml, req);
        const transformed = await vite.transformIndexHtml(req.originalUrl, seoHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (e) {
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      const rawHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
      const seoHtml = injectRouteSeoIntoHtml(rawHtml, req);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sahiroomie server listening on http://localhost:${PORT}`);
  });
}

startServer();
