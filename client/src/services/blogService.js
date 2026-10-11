import api from './api.js';

// Image uploads can take longer than the default 15s API timeout.
const UPLOAD_TIMEOUT_MS = 60000;

/**
 * Builds the request body for create/update.
 * - Plain JSON when there is no image change (keeps the old behaviour, e.g. status toggles).
 * - multipart/form-data when a new image file is attached or the image is being removed.
 * `imageFile` (File) and `removeImage` (boolean) are UI-only fields, never sent as JSON.
 */
const buildBlogRequest = (data = {}) => {
  const { imageFile, removeImage, ...fields } = data;
  if (!imageFile && !removeImage) {
    return { body: fields, config: undefined };
  }
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });
  if (imageFile) form.append('image', imageFile);
  if (removeImage && !imageFile) form.append('remove_image', 'true');
  return {
    body: form,
    // Override the instance's JSON default: the browser must set the multipart boundary itself.
    config: { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT_MS },
  };
};

export const blogService = {
  // Public blog endpoints
  // Returns { blogs: [...], pagination: { currentPage, limit, totalBlogs, totalPages } }
  async getPublishedBlogs({ search = '', tag = '', page = 1, limit = 9, sort = '' } = {}) {
    const params = { page, limit };
    if (search) params.search = search;
    if (tag) params.tag = tag;
    if (sort && sort !== 'latest') params.sort = sort; // 'latest' is the server default
    const response = await api.get('/blogs', { params });
    return response.data || { blogs: [], pagination: { currentPage: 1, limit, totalBlogs: 0, totalPages: 0 } };
  },

  async getPublishedBlogById(id) {
    const response = await api.get(`/blogs/${id}`);
    return response.data;
  },

  // Related published blogs (shared tags), current blog excluded. Returns { blogs: [...] }
  async getRelatedBlogs(id, limit = 3) {
    const response = await api.get(`/blogs/${id}/related`, { params: { limit } });
    return response.data;
  },

  // Counts one view (public). Returns { views }.
  async recordBlogView(id) {
    const response = await api.post(`/blogs/${id}/view`);
    return response.data;
  },

  // Like state: { like_count, liked }. `liked` is only meaningful when a Firebase user is signed in
  // (the api interceptor attaches the token automatically).
  async getBlogLikes(id) {
    const response = await api.get(`/blogs/${id}/likes`);
    return response.data;
  },

  // Requires a signed-in Firebase user. The backend takes the user from the verified token.
  async likeBlog(id) {
    const response = await api.post(`/blogs/${id}/like`);
    return response.data;
  },

  async unlikeBlog(id) {
    const response = await api.delete(`/blogs/${id}/like`);
    return response.data;
  },

  // Comments (oldest first). Returns { comments: [{ id, content, created_at, author_name }] }
  async getBlogComments(id) {
    const response = await api.get(`/blogs/${id}/comments`);
    return response.data;
  },

  // Requires a signed-in Firebase user; the author is taken from the verified token on the server.
  // Returns { comment }.
  async addBlogComment(id, content) {
    const response = await api.post(`/blogs/${id}/comments`, { content });
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

  // data: { title, content, tags, conclusion, status, imageFile?: File }
  async createBlog(data) {
    const { body, config } = buildBlogRequest(data);
    const response = await api.post('/admin/blogs', body, config);
    return response.data;
  },

  // `id` is the public 4-digit Blog ID. data may include imageFile (replace) or removeImage.
  async updateBlog(id, data) {
    const { body, config } = buildBlogRequest(data);
    const response = await api.put(`/admin/blogs/${id}`, body, config);
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
