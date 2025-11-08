import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import userRoutes from './routes/userRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { sendContactEmail } from './services/emailService.js';
import { startSubscriptionExpiryCheck } from './utils/subscriptionCron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

// Allowed origins (prefer environment variable ALLOWED_ORIGINS)
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'https://www.marketmindsresearch.com',
      'https://marketmindsresearch.com'
    ]
);

// CORS
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman / curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.log('🚫 [CORS] Blocked origin:', origin);
    return cb(null, true); // Change to cb(new Error('Not allowed by CORS')) to enforce
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-admin-auth','Accept'],
  exposedHeaders: ['Content-Length','Content-Type'],
  maxAge: 86400
}));
// Note: Express 5 (path-to-regexp v8) no longer supports "*" path patterns.
// The global CORS middleware above already handles preflight OPTIONS requests,
// so we don't need an explicit app.options('*', cors()) here.

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging
app.use(morgan('dev'));

// Simple request log
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin || 'n/a'}`);
  next();
});

// Helper: prevent absolute URL paths inside route modules
const sanitizeRouterPaths = (router, tag) => {
  if (!router || !router.stack) return;
  router.stack.forEach(layer => {
    if (layer.route && typeof layer.route.path === 'string') {
      const p = layer.route.path;
      if (p.includes('://')) {
        console.warn(`⚠️ [ROUTE-SANITIZE] ${tag} had absolute path "${p}". Replacing with "/"`);
        layer.route.path = '/';
      } else if (/^https:/.test(p)) {
        console.warn(`⚠️ [ROUTE-SANITIZE] ${tag} bad path "${p}".`);
        layer.route.path = '/';
      }
    }
  });
};

// Safe mount wrapper that catches path-to-regexp errors
const safeMount = (base, router, tag) => {
  try {
    sanitizeRouterPaths(router, tag);
    app.use(base, router);
  } catch (err) {
    console.error(`❌ [MOUNT ERROR] Failed mounting ${tag} at ${base}:`, err.message);
  }
};

// Contact email direct endpoint
app.post('/api/contacts/email', async (req, res) => {
  try {
    const { name, email, phone, country, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    await sendContactEmail({ name, email, phone, country, message });
    return res.status(200).json({ success: true, message: 'Message sent' });
  } catch (err) {
    console.error('❌ [CONTACT EMAIL] Error:', err.message);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mount routers (use safeMount)
safeMount('/api/users', userRoutes, 'userRoutes');
safeMount('/api/reports', reportRoutes, 'reportRoutes');
safeMount('/api', paymentRoutes, 'paymentRoutes');
safeMount('/api/contacts', contactRoutes, 'contactRoutes');
safeMount('/api/admin', adminRoutes, 'adminRoutes');

// Debug: list final registered top-level paths
setImmediate(() => {
  try {
    const routerStack = app?._router?.stack;
    if (!Array.isArray(routerStack)) {
      console.log('🔍 Registered routes: (router stack unavailable)');
      return;
    }
    console.log('🔍 Registered routes:');
    routerStack
      .filter(l => l.route && l.route.path)
      .forEach(l => {
        const methods = Object.keys(l.route.methods).join(',').toUpperCase();
        console.log(`   ${methods.padEnd(8)} ${l.route.path}`);
      });
  } catch (e) {
    console.warn('⚠️ [ROUTE LIST] Could not enumerate routes:', e.message);
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Root
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'MarketMinds API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404
app.use((req, res) => {
  console.log(`❌ [404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ [ERROR]', err.message);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Mongo + start
mongoose.connect(DB_URI).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
  });
  startSubscriptionExpiryCheck();
}).catch(err => {
  console.error('❌ Mongo connection error:', err.message);
  process.exit(1);
});

export default app;
