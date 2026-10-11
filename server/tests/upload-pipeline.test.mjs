/**
 * Integration test of the admin create/update upload flow:
 *   validateImageFile -> compressImage -> imageService.upload (Cloudinary) -> blogService (MySQL)
 *
 * The REAL blogController, validation and compression (sharp) run. Only the two services that need
 * network/database access (imageService = Cloudinary, blogService = MySQL) are replaced with
 * in-memory fakes that record what they receive, so nothing leaves the machine.
 *
 * Run from the project root (Node 22+, needs `npm install` for sharp):
 *   node --experimental-test-module-mocks --test server/tests/upload-pipeline.test.mjs
 */
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}
const SKIP = sharp ? false : 'sharp is not installed (run npm install)';

// ---- fakes -------------------------------------------------------------------------------
const calls = { upload: [], remove: [], createBlog: [], updateBlog: [] };
let uploadImpl;
let createImpl;

const fakeImageService = {
  upload: async (buffer) => {
    calls.upload.push(buffer);
    return uploadImpl(buffer);
  },
  remove: async (publicId) => {
    calls.remove.push(publicId);
    return true;
  },
};
const fakeBlogService = {
  createBlog: async (data) => {
    calls.createBlog.push(data);
    return createImpl(data);
  },
  updateBlog: async (id, data) => {
    calls.updateBlog.push({ id, data });
    return { blog_id: id, ...data };
  },
  getRawByBlogId: async (id) => ({ blog_id: id, image_public_id: 'utsanova-blog/old-image' }),
};

mock.module('../src/services/imageService.js', { defaultExport: fakeImageService, namedExports: { imageService: fakeImageService } });
mock.module('../src/services/blogService.js', { defaultExport: fakeBlogService, namedExports: { blogService: fakeBlogService } });

const { blogController } = await import('../src/controllers/blogController.js');
const { MAX_IMAGE_BYTES } = await import('../src/utils/imageValidation.js');

// ---- helpers -----------------------------------------------------------------------------
const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const body = { title: 'A valid title', content: 'Some content', tags: 'Technology', conclusion: 'Done', status: 'Draft' };
const file = (buffer, mimetype) => ({ buffer, mimetype, size: buffer.length, originalname: 'x' });
const run = async (handler, req) => {
  const r = res();
  let nextErr = null;
  await handler(req, r, (e) => (nextErr = e));
  return { r, nextErr };
};

const bigNoiseJpeg = async () => {
  for (const quality of [75, 60, 45, 30]) {
    const buf = await sharp({
      create: { width: 3600, height: 2400, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
    }).jpeg({ quality }).toBuffer();
    if (buf.length < MAX_IMAGE_BYTES * 0.95) return buf;
  }
  throw new Error('could not build a fixture under the upload limit');
};
const transparentPng = (w, h) =>
  sharp(Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#6366f1"/></svg>`)).png().toBuffer();

beforeEach(() => {
  for (const k of Object.keys(calls)) calls[k] = [];
  uploadImpl = async () => ({ url: 'https://res.cloudinary.com/demo/image/upload/v1/utsanova-blog/new.jpg', publicId: 'utsanova-blog/new' });
  createImpl = async (d) => ({ blog_id: 1, ...d });
});

describe('create blog with an image (real controller + validation + sharp)', { skip: SKIP }, () => {
  it('uploads the COMPRESSED buffer (resized, smaller), stores the returned url/publicId, returns 201', async () => {
    const original = await bigNoiseJpeg();
    const { r } = await run(blogController.createBlog, { body, file: file(original, 'image/jpeg') });
    assert.equal(r.statusCode, 201);
    assert.equal(calls.upload.length, 1);
    const sent = calls.upload[0];
    assert.notDeepEqual(sent, original, 'the original bytes must not be uploaded');
    assert.ok(sent.length < original.length, `uploaded ${sent.length} should be < original ${original.length}`);
    const meta = await sharp(sent).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(Math.max(meta.width, meta.height), 2000);
    assert.deepEqual(calls.createBlog[0].image, { url: 'https://res.cloudinary.com/demo/image/upload/v1/utsanova-blog/new.jpg', publicId: 'utsanova-blog/new' });
  });

  it('keeps PNG transparency in what is uploaded', async () => {
    const png = await transparentPng(2600, 1800);
    const { r } = await run(blogController.createBlog, { body, file: file(png, 'image/png') });
    assert.equal(r.statusCode, 201);
    const meta = await sharp(calls.upload[0]).metadata();
    assert.equal(meta.format, 'png');
    assert.equal(meta.hasAlpha, true);
    const { data, info } = await sharp(calls.upload[0]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, 'corner pixel is still fully transparent');
    assert.equal(data[((info.height >> 1) * info.width + (info.width >> 1)) * 4 + 3], 255, 'centre pixel is still opaque');
  });

  it('works without an image (JSON-style request): nothing is compressed or uploaded', async () => {
    const { r } = await run(blogController.createBlog, { body });
    assert.equal(r.statusCode, 201);
    assert.equal(calls.upload.length, 0);
    assert.equal(calls.createBlog[0].image, null);
  });

  it('rejects a corrupt image (valid JPEG header + garbage) with 400: no upload, nothing saved', async () => {
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
    const { r } = await run(blogController.createBlog, { body, file: file(corrupt, 'image/jpeg') });
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.success, false);
    assert.equal(calls.upload.length, 0);
    assert.equal(calls.createBlog.length, 0);
  });

  it('rejects a disguised file (HTML declared as PNG) with 400 before compression', async () => {
    const { r } = await run(blogController.createBlog, { body, file: file(Buffer.from('<html><script>alert(1)</script></html>'), 'image/png') });
    assert.equal(r.statusCode, 400);
    assert.equal(calls.upload.length, 0);
  });

  it('rejects an unsupported declared type (GIF) with 400', async () => {
    const { r } = await run(blogController.createBlog, { body, file: file(Buffer.from('GIF89a....'), 'image/gif') });
    assert.equal(r.statusCode, 400);
    assert.equal(calls.upload.length, 0);
  });

  it('rejects a file over the 4 MB limit with 400 (limit unchanged)', async () => {
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_IMAGE_BYTES + 10)]);
    const { r } = await run(blogController.createBlog, { body, file: file(huge, 'image/jpeg') });
    assert.equal(r.statusCode, 400);
    assert.equal(calls.upload.length, 0);
  });

  it('still validates the blog fields first (missing title -> 400, no upload)', async () => {
    const { r } = await run(blogController.createBlog, { body: { ...body, title: '' }, file: file(await transparentPng(100, 100), 'image/png') });
    assert.equal(r.statusCode, 400);
    assert.equal(calls.upload.length, 0);
  });

  it('a Cloudinary failure surfaces as an error and nothing is saved', async () => {
    uploadImpl = async () => {
      const e = new Error('Image upload failed. Please try again in a moment.');
      e.statusCode = 502;
      throw e;
    };
    const { nextErr } = await run(blogController.createBlog, { body, file: file(await transparentPng(300, 300), 'image/png') });
    assert.equal(nextErr.statusCode, 502);
    assert.equal(calls.createBlog.length, 0);
  });

  it('rolls back: if saving to MySQL fails after the upload, the uploaded image is deleted', async () => {
    createImpl = async () => {
      throw new Error('db down');
    };
    const { nextErr } = await run(blogController.createBlog, { body, file: file(await transparentPng(300, 300), 'image/png') });
    assert.equal(nextErr.message, 'db down');
    assert.deepEqual(calls.remove, ['utsanova-blog/new']);
  });
});

describe('update blog with an image', { skip: SKIP }, () => {
  it('uploads the compressed buffer and deletes the previous Cloudinary image', async () => {
    const original = await bigNoiseJpeg();
    const { r } = await run(blogController.updateBlog, { params: { id: '1005' }, body, file: file(original, 'image/jpeg') });
    assert.equal(r.statusCode, 200);
    assert.ok(calls.upload[0].length < original.length);
    const meta = await sharp(calls.upload[0]).metadata();
    assert.equal(Math.max(meta.width, meta.height), 2000);
    assert.equal(calls.updateBlog[0].data.image.publicId, 'utsanova-blog/new');
    assert.deepEqual(calls.remove, ['utsanova-blog/old-image']);
  });

  it('a corrupt replacement image is rejected and the existing image is NOT deleted', async () => {
    const corrupt = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500, 3)]);
    const { r } = await run(blogController.updateBlog, { params: { id: '1005' }, body, file: file(corrupt, 'image/png') });
    assert.equal(r.statusCode, 400);
    assert.equal(calls.upload.length, 0);
    assert.equal(calls.updateBlog.length, 0);
    assert.equal(calls.remove.length, 0);
  });
});
