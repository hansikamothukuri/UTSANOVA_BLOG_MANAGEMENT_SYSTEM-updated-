import { Router } from 'express';
import userService from '../services/userService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { requireOwner } from '../middleware/permissionMiddleware.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getBootstrapOwnerUids } from '../utils/permissions.js';

const router = Router();

// OWNERS ONLY (any number of database-backed owners + bootstrap owners): everyone else is rejected
// by requireOwner before any handler runs. Ownership is re-read from the database on every request.
router.use(authMiddleware, adminMiddleware, requireOwner);

// GET /api/admin/users
router.get('/', async (req, res, next) => {
  try {
    const users = await userService.list();
    return sendSuccess(res, {
      users,
      owner_count: users.filter((u) => u.is_owner && u.is_active).length,
      bootstrap_owner_count: getBootstrapOwnerUids().length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users  { email, name?, permissions: [...] }
router.post('/', async (req, res, next) => {
  try {
    const { email, name, permissions } = req.body || {};
    const result = await userService.create({ email, name, permissions, actorUid: req.user.uid });
    res.set('Cache-Control', 'no-store'); // response contains a one-time password-setup link
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/permissions  { permissions: [...] }
router.put('/:id/permissions', async (req, res, next) => {
  try {
    const user = await userService.setPermissions(req.params.id, req.body?.permissions, req.user.uid);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/owner  { is_owner: true|false }  - add / remove owner status
router.put('/:id/owner', async (req, res, next) => {
  try {
    const user = await userService.setOwner(req.params.id, req.body?.is_owner, req.user.uid);
    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id  { is_active: true|false }
router.patch('/:id', async (req, res, next) => {
  try {
    return sendSuccess(res, await userService.setActive(req.params.id, req.body?.is_active, req.user.uid));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    return sendSuccess(res, await userService.remove(req.params.id, req.user.uid));
  } catch (err) {
    next(err);
  }
});

export default router;
