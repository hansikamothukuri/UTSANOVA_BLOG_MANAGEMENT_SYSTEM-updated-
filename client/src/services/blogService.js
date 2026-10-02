import api from './api.js';

export const blogService = {
  // Public blog endpoints
  // Returns { blogs: [...], pagination: { currentPage, limit, totalBlogs, totalPages } }
  async getPublishedBlogs({ search = '', tag = '', page = 1, limit = 9 } = {}) {
    const params = { page, limit };
    if (search) params.search = search;
    if (tag) params.tag = tag;
    const response = await api.get('/blogs', { params });
    return response.data || { blogs: [], pagination: { currentPage: 1, limit, totalBlogs: 0, totalPages: 0 } };
  },

  async getPublishedBlogById(id) {
    const response = await api.get(`/blogs/${id}`);
    return response.data;
  },

  // Admin blog management endpoints
  // Returns { blogs: [...], pagination: { currentPage, limit, totalBlogs, totalPages } }
  async getAdminBlogs({ status = '', search = '', page = 1, limit = 9 } = {}) {
    const params = { page, limit };
    if (status) params.status = status;
    if (search) params.search = search;
    const response = await api.get('/admin/blogs', { params });
    return (
      response.data || {
        blogs: [],
        pagination: { currentPage: 1, limit, totalBlogs: 0, totalPages: 0 },
      }
    );
  },

  async getAdminBlogById(id) {
    const response = await api.get(`/admin/blogs/${id}`);
    return response.data;
  },

  async createBlog(data) {
    const response = await api.post('/admin/blogs', data);
    return response.data;
  },

  async updateBlog(id, data) {
    const response = await api.put(`/admin/blogs/${id}`, data);
    return response.data;
  },

  async deleteBlog(id) {
    const response = await api.delete(`/admin/blogs/${id}`);
    return response.data;
  },

  // Admin dashboard stats
  async getDashboardStats() {
    const response = await api.get('/admin/dashboard/stats');
    return response.data;
  },

  // Future enhancement: AI Blog Generator
  async generateAiBlog(topic, keywords = '') {
    const response = await api.post('/admin/ai/generate-ai', { topic, keywords });
    return response.data;
  },
};

export default blogService;
