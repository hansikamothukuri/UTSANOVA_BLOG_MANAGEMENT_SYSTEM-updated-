import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

const isProduction =
  process.env.VERCEL === '1' ||
  process.env.NODE_ENV === 'production';

// On Vercel, use platform Environment Variables.
// Locally, load server/.env and then the legacy root .env.
// dotenv does not override variables already present in process.env.
if (!isProduction) {
  const serverResult = dotenv.config({
    path: SERVER_ENV_PATH,
    quiet: true,
  });

  dotenv.config({ quiet: true });

  console.log(
    `[Env] server/.env ${
      fs.existsSync(SERVER_ENV_PATH) && !serverResult.error
        ? 'loaded'
        : 'NOT FOUND'
    } (${SERVER_ENV_PATH})`
  );
} else {
  console.log('[Env] Production environment: using platform variables');
}

// Report presence only; never log secret values.
const mask = (name, minLen = 1) => {
  const value = process.env[name];
  return `${name}=${value && value.length >= minLen ? 'set' : 'MISSING'}`;
};

console.log(
  '[Env] ' +
    [
      mask('DATABASE_HOST'),
      mask('FIREBASE_ADMIN_PRIVATE_KEY'),
      mask('GEMINI_API_KEY'),
      mask('CLOUDINARY_API_SECRET'),
    ].join(' | ')
);