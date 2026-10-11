import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Public Pages
import HomePage from './pages/public/HomePage.jsx';
import BlogsPage from './pages/public/BlogsPage.jsx';
import BlogDetailPage from './pages/public/BlogDetailPage.jsx';

// Admin Pages
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminBlogsPage from './pages/admin/AdminBlogsPage.jsx';
import AdminBlogFormPage from './pages/admin/AdminBlogFormPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes with PublicLayout */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/blogs" element={<BlogsPage />} />
            <Route path="/blogs/:id" element={<BlogDetailPage />} />
          </Route>

          {/* Admin Login (Unprotected) */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Protected Admin Routes with AdminLayout */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="blogs" element={<AdminBlogsPage />} />
            <Route path="blogs/new" element={<AdminBlogFormPage />} />
            <Route path="blogs/:id/edit" element={<AdminBlogFormPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
