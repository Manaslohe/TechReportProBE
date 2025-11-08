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

// CORS Configuration - Updated for production
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://www.marketmindsresearch.com',
    'https://marketmindsresearch.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('🚫 [CORS] Blocked origin:', origin);
            callback(null, true); // Allow for now, change to callback(new Error('Not allowed by CORS')) in production
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-auth', 'Accept'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging middleware
app.use(morgan('dev'));

// Request logging for debugging
app.use((req, res, next) => {
    console.log(`📝 [${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log(`   → Origin: ${req.headers.origin || 'No origin'}`);
    next();
});

// Email route
app.post('/api/contacts/email', async (req, res) => {
    try {
        const { name, email, phone, country, message } = req.body || {};
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required.' });
        }

        await sendContactEmail({ name, email, phone, country, message });
        return res.status(200).json({ success: true, message: 'Message sent' });
    } catch (err) {
        console.error('Send mail error:', err?.message || err);
        return res.status(500).json({ error: 'Failed to send message' });
    }
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', paymentRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/admin', adminRoutes);

// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ 
        status: 'Server is running', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root route
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'MarketMinds API Server',
        version: '1.0.0',
        status: 'active'
    });
});

// Error Handling Middleware
app.use((req, res, next) => {
    console.log(`❌ [404] Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('❌ [ERROR]:', err.message);
    console.error('   → Stack:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Connect to MongoDB
mongoose.connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected');
    
    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
        console.log(`   → Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   → CORS Origins: ${allowedOrigins.join(', ')}`);
    });
    
    // Start cron jobs
    startSubscriptionExpiryCheck();
})
.catch((error) => {
    console.error('❌ Error connecting to MongoDB:', error.message);
    console.error('   → Full error:', error);
    process.exit(1);
});

export default app;
