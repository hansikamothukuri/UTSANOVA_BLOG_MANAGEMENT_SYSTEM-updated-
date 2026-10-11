import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import app from './server/src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Attach Vite dev server middleware to Express
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted in development mode');
  } else {
    // Production static file serving
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
          return next();
        }
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 UTSANOVA BLOG MANAGEMENT SYSTEM (FULL-STACK)`);
    console.log(`Running on: http://0.0.0.0:${PORT}`);
    console.log(`Database: MySQL (utsanova_blog) / Relational Layer`);
    console.log(`Firebase Auth: Admin SDK Verification Active`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Server Start Failure]:', err);
  process.exit(1);
});
