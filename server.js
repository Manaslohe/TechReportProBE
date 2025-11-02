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
import { sendContactEmail } from './services/emailService.js'; // UPDATED

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173', 
    'https://techreportspro.vercel.app',
    'https://techbe-zeta.vercel.app'
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Email route (UPDATED to use service)
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

// Connect to MongoDB
mongoose.connect(DB_URI)
	.then(() => {
		console.log('Connected to MongoDB');
		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	})
	.catch((error) => {
		console.error('Error connecting to MongoDB:', error);
	});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', paymentRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/admin', adminRoutes);

// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Server is running', timestamp: new Date() });
});

// Error Handling Middleware
app.use((req, res, next) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
});

