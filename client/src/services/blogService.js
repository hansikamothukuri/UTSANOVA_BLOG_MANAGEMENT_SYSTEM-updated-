import api from './api.js';

export const blogService = {
  async saveBlog(url, data, method) {
    const { image_file: imageFile, ...blogData } = data;
    if (!imageFile) {
      return api[method](url, blogData);
    }

    const formData = new FormData();
    for (const [key, value] of Object.entries(blogData)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    formData.append('image', imageFile);
    return api[method](url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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
    return this.saveBlog('/admin/blogs', data, 'post');
  },

  async updateBlog(id, data) {
    return this.saveBlog(`/admin/blogs/${id}`, data, 'put');
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
