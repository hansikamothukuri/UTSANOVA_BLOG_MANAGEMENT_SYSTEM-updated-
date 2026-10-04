import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

/**
 * Loads backend environment variables from server/.env, regardless of the
 * directory the process was started from (project root via `npm run dev`,
 * or server/ via `npm --prefix server run dev`).
 *
 * This module must be the FIRST import of the backend entry (app.js) so the
 * variables exist before any other module is evaluated.
 *
 * Precedence (dotenv never overrides an existing variable):
 *   1. real process environment (hosting platform / shell)
 *   2. server/.env
 *   3. <cwd>/.env  (legacy fallback: previous behaviour)
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

const serverResult = dotenv.config({ path: SERVER_ENV_PATH, quiet: true });
dotenv.config({ quiet: true }); // legacy fallback: .env in current working directory

// Secret-safe startup diagnostics: reports presence only, never values.
const mask = (name, minLen = 1) => {
  const v = process.env[name];
  return `${name}=${v && v.length >= minLen ? 'set' : 'MISSING'}`;
};
console.log(
  `[Env] server/.env ${fs.existsSync(SERVER_ENV_PATH) && !serverResult.error ? 'loaded' : 'NOT FOUND'} (${SERVER_ENV_PATH})`
);
console.log(
  '[Env] ' +
    [
      mask('DATABASE_HOST'),
      mask('FIREBASE_ADMIN_PRIVATE_KEY'),
      mask('GEMINI_API_KEY'),
      mask('OPENAI_API_KEY'),
    ].join(' | ')
);
