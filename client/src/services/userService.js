import api from './api.js';

// Owner-only user management (the backend rejects everyone else with 403).
export const userService = {
  async list() {
    const response = await api.get('/admin/users');
    return response.data; // { users: [...], owner_configured }
  },
  // data: { email, name?, permissions: ['BLOG_READ', ...] } -> { user, password_setup_link }
  async create(data) {
    const response = await api.post('/admin/users', data);
    return response.data;
  },
  async setPermissions(id, permissions) {
    const response = await api.put(`/admin/users/${id}/permissions`, { permissions });
    return response.data.user;
  },
  // Add / remove owner status (owners only; the server protects the last owner and bootstrap owners)
  async setOwner(id, isOwner) {
    const response = await api.put(`/admin/users/${id}/owner`, { is_owner: isOwner });
    return response.data.user;
  },
  async setActive(id, isActive) {
    const response = await api.patch(`/admin/users/${id}`, { is_active: isActive });
    return response.data;
  },
  async remove(id) {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },
};

export const PERMISSION_OPTIONS = [
  { code: 'BLOG_READ', label: 'Read', hint: 'View blogs in the admin portal' },
  { code: 'BLOG_CREATE', label: 'Create', hint: 'Create new blogs' },
  { code: 'BLOG_UPDATE', label: 'Update', hint: 'Edit, schedule, reschedule, cancel schedule' },
  { code: 'BLOG_DELETE', label: 'Delete', hint: 'Delete blogs' },
];

export default userService;
