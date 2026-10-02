// Vercel serverless entry point.
// Vercel invokes this exported Express app as a request handler (no app.listen()).
// vercel.json rewrites every /api/* request here; Express still sees the original
// URL (e.g. /api/admin/blogs), so all existing routes work unchanged.
import app from '../server/src/app.js';

export default app;
