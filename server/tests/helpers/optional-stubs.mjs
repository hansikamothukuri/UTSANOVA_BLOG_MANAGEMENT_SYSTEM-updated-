/**
 * Module-resolution hook used ONLY by the permission/scheduling tests: when a third-party package is
 * not installed (e.g. in a sandbox without `npm install`), a tiny stub is served instead so the pure
 * application logic can still be exercised. When the real package IS installed, it is used as-is.
 * The tests never need real MySQL / Firebase / Cloudinary: they run on the local JSON fallback store.
 */
const STUBS = {
  'mysql2/promise': 'export default { createPool() { throw new Error("mysql2 stub: no MySQL in tests"); } };',
  'firebase-admin/app': 'export const cert = (x) => x; export const getApps = () => []; export const initializeApp = () => ({});',
  'firebase-admin/auth': 'export const getAuth = () => { throw new Error("firebase-admin stub: not available in tests"); };',
  cloudinary: 'export const v2 = { config() {}, uploader: {} };',
  express: 'export const Router = () => ({ use() {}, get() {}, post() {}, put() {}, patch() {}, delete() {} }); export default {};',
  sharp: 'export default function sharp() { throw new Error("sharp stub"); }',
};

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err && err.code === 'ERR_MODULE_NOT_FOUND' && STUBS[specifier]) {
      return { url: 'data:text/javascript,' + encodeURIComponent(STUBS[specifier]), shortCircuit: true };
    }
    throw err;
  }
}
