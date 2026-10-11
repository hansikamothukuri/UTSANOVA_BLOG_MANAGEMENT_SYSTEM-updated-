import './config/env.js'; // must stay first: loads server/.env before other modules
import express from 'express';
import cors from 'cors';
import { initDB } from './config/db.js';
import { initFirebaseAdmin } from './config/firebase.js';
import publicBlogRoutes from './routes/publicBlogRoutes.js';
import adminBlogRoutes from './routes/adminBlogRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// Initialize Database connection & Firebase Admin
initDB().catch((err) => console.error('[DB Init Error]:', err));
initFirebaseAdmin();

// Global Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'Utsanova Blog Management System',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes according to SRS specification
app.use('/api/auth', authRoutes);
app.use('/api/blogs', publicBlogRoutes);
app.use('/api/admin/blogs', adminBlogRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/ai', aiRoutes);

// 404 & Centralized Error Handlers
app.use('/api/*', notFoundHandler);
app.use(errorHandler);

export default app;
