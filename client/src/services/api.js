import axios from 'axios';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config.js';

// Dynamically resolve base API URL
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    // If env URL points to localhost, but the user is accessing via cloud deployment (*.run.app)
    // NEVER point to localhost because the remote browser cannot access port 5000 on the local machine!
    if (!isLocalhost && envUrl && envUrl.includes('localhost')) {
      return '/api';
    }

    // In full-stack mode (Express + Vite) or standard relative API, use /api on same host
    if (!envUrl || envUrl.trim() === '' || envUrl === '/api') {
      return '/api';
    }

    return envUrl;
  }

  return envUrl || '/api';
};

const baseURL = getBaseURL();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach a fresh Firebase ID token (Authorization: Bearer <JWT>).
// The token is read from the Firebase SDK on every request - never cached or stored by the app -
// so it is always the complete, current JWT (the SDK refreshes it automatically before expiry).
api.interceptors.request.use(
  async (config) => {
    try {
      await auth.authStateReady(); // wait for Firebase to restore the session after a page reload
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[api] Could not obtain Firebase ID token:', err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Extract response data and normalize errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';
    const status = error.response?.status;

    // Handle 401 Unauthorized redirect to login if on admin route
    if (status === 401 && window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
      // Drop the rejected Firebase session so the login page does not bounce straight back
      signOut(auth)
        .catch(() => {})
        .finally(() => {
          window.location.href = '/admin/login';
        });
    }

    return Promise.reject({
      status,
      message,
      // Machine-readable error code + extra fields from the API (if provided)
      code: error.response?.data?.code,
      data: error.response?.data,
      originalError: error,
    });
  }
);

export default api;
