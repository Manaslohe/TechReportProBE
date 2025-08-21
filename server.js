import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from './models/User.js'; // Create this model
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import Report from './models/Report.js';
import PaymentRequest from './models/PaymentRequest.js'; // Import PaymentRequest model
import Contact from './models/Contact.js'; // Import the Contact model

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_URI = process.env.DB_URI;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit to 10MB
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Increase URL-encoded payload limit

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

// Default route
app.get('/', (req, res) => {
    res.send('Backend server is running');
});

// User Signup
app.post('/api/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ firstName, lastName, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error registering user' });
    }
});

// User Signin
app.post('/api/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Respond with token and user data
        res.status(200).json({
            token,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            },
        });
    } catch (error) {
        console.error('Error during signin:', error); // Log the error for debugging
        res.status(500).json({ error: 'Error signing in' });
    }
});

// Separate multer configurations for different file types
const pdfStorage = multer.diskStorage({
    destination: 'uploads/reports/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const screenshotStorage = multer.diskStorage({
    destination: 'uploads/screenshots/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const uploadPDF = multer({
    storage: pdfStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'));
        }
    }
});

const uploadScreenshot = multer({
    storage: screenshotStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

const upload = multer(); // Use memory storage for multer

// Create upload directories if they don't exist
['uploads/reports', 'uploads/screenshots'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Report Routes
app.post('/api/reports', uploadPDF.single('file'), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description || !req.file) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const report = new Report({
            title,
            description,
            pdf: {
                data: req.file.buffer,
                contentType: req.file.mimetype || 'application/pdf',
            },
        });

        await report.save();
        res.status(201).json(report);
    } catch (error) {
        console.error('Error uploading report:', error);
        res.status(500).json({ error: 'Error uploading report' });
    }
});

app.get('/api/reports', async (req, res) => {
    try {
        const reports = await Report.find().sort({ uploadDate: -1 });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching reports' });
    }
});

app.delete('/api/reports/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        await Report.findByIdAndDelete(req.params.id);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Error deleting report' });
    }
});

// Get single report
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching report' });
  }
});

// Middleware to verify JWT token or allow hardcoded admin credentials
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    // Allow hardcoded admin credentials for admin routes
    if (req.headers['x-admin-auth'] === 'true') {
      req.user = { isAdmin: true }; // Mock admin user with isAdmin flag
      return next();
    }

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Session expired, please login again',
        code: 'TOKEN_EXPIRED'
      });
    }
    res.status(401).json({ 
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Payment Request Routes
app.post('/api/payment-requests', verifyToken, async (req, res) => {
  try {
    const { reportId, screenshotData } = req.body;

    console.log('Received screenshotData:', screenshotData); // Debugging log

    if (!screenshotData) {
      return res.status(400).json({
        error: 'Payment screenshot is required',
        code: 'SCREENSHOT_REQUIRED'
      });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ 
        error: 'Report not found',
        code: 'REPORT_NOT_FOUND'
      });
    }

    // Check if user already has a pending request for this report
    const existingRequest = await PaymentRequest.findOne({
      user: req.user._id,
      report: reportId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        error: 'You already have a pending request for this report',
        code: 'DUPLICATE_REQUEST'
      });
    }

    // Check if user already purchased this report
    const alreadyPurchased = req.user.purchasedReports.includes(reportId);
    if (alreadyPurchased) {
      return res.status(400).json({
        error: 'You have already purchased this report',
        code: 'ALREADY_PURCHASED'
      });
    }

    const paymentRequest = new PaymentRequest({
      user: req.user._id,
      report: reportId,
      amount: 500,
      screenshotData,
      status: 'pending'
    });

    await paymentRequest.save();

    // Add to user's payment requests
    req.user.paymentRequests.push(paymentRequest._id);
    await req.user.save();

    res.status(201).json({
      message: 'Payment request submitted successfully',
      requestId: paymentRequest._id
    });
  } catch (error) {
    console.error('Payment request error:', error); // Log the error
    res.status(500).json({ 
      error: 'Error creating payment request',
      code: 'SERVER_ERROR'
    });
  }
});

app.get('/api/payment-requests', verifyToken, async (req, res) => {
  try {
    const requests = await PaymentRequest.find()
      .populate('user', 'firstName lastName email')
      .populate('report', 'title')
      .sort('-createdAt');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ 
      error: 'Error fetching payment requests',
      code: 'SERVER_ERROR'
    });
  }
});

// Payment Request Verification Route
app.post('/api/payment-requests/:id/verify', verifyToken, async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    const request = await PaymentRequest.findById(req.params.id).populate('user').populate('report');

    if (!request) {
      return res.status(404).json({ 
        error: 'Payment request not found',
        code: 'REQUEST_NOT_FOUND'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        error: 'This request has already been processed',
        code: 'ALREADY_PROCESSED'
      });
    }

    if (status === 'approved') {
      if (!request.user) {
        return res.status(404).json({
          error: 'User associated with this request not found',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!request.report) {
        return res.status(404).json({
          error: 'Report associated with this request not found',
          code: 'REPORT_NOT_FOUND'
        });
      }

      request.user.purchasedReports.push(request.report._id);
      await request.user.save();
    }

    request.status = status;
    request.adminComment = adminComment;
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    await request.save();

    res.json({
      message: `Payment request ${status} successfully`,
      request
    });
  } catch (error) {
    console.error('Error verifying payment request:', error); // Log the error
    res.status(500).json({ 
      error: 'Error verifying payment request',
      code: 'SERVER_ERROR'
    });
  }
});

// Add purchased reports endpoint
app.get('/api/users/purchased-reports', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).populate('purchasedReports');
        res.json(user.purchasedReports || []);
    } catch (error) {
        console.error('Error fetching purchased reports:', error);
        res.status(500).json({ error: 'Error fetching purchased reports' });
    }
});

// Contact Form Submission Route
app.post('/api/contact', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let user = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
      } catch (error) {
        console.error('Error verifying token:', error);
      }
    }

    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const contact = new Contact({
      user: user ? user._id : null,
      name,
      email,
      phone,
      subject,
      message
    });

    await contact.save();
    res.status(201).json({ message: 'Contact form submitted successfully' });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({ error: 'Error submitting contact form' });
  }
});

// Admin route to fetch all contact submissions
app.get('/api/admin/contacts', verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const contacts = await Contact.find()
      .populate('user', 'firstName lastName email')
      .sort('-submittedAt');
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contact submissions:', error);
    res.status(500).json({ error: 'Error fetching contact submissions' });
  }
});

// Admin route to fetch all users with their details
app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await User.find()
      .populate('purchasedReports')
      .populate({
        path: 'paymentRequests',
        populate: { path: 'report', select: 'title' }
      })
      .sort('-createdAt');

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Add a route to fetch all requests
app.get('/api/requests', verifyToken, async (req, res) => {
    try {
        // Ensure the user is an admin
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Fetch all payment requests
        const requests = await PaymentRequest.find()
            .populate('user', 'firstName lastName email') // Populate user details
            .populate('report', 'title') // Populate report details
            .sort('-createdAt'); // Sort by creation date (newest first)

        res.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Error fetching requests' });
    }
});

// Admin Dashboard Route
app.get('/api/admin/dashboard', verifyToken, async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch total counts
    const totalUsers = await User.countDocuments();
    const totalReports = await Report.countDocuments();
    const totalRequests = await PaymentRequest.countDocuments();
    const pendingRequests = await PaymentRequest.countDocuments({ status: 'pending' });
    const totalContacts = await Contact.countDocuments();
    const unreadContacts = await Contact.countDocuments({ isRead: false });

    // Fetch recent data
    const recentUsers = await User.find().sort('-createdAt').limit(5).select('firstName lastName email createdAt');
    const recentRequests = await PaymentRequest.find()
      .populate('user', 'firstName lastName')
      .sort('-createdAt')
      .limit(5)
      .select('status createdAt user');

    const popularReports = await Report.find()
      .sort('-downloads')
      .limit(5)
      .select('title downloads revenue');

    // Mock sales data
    const recentSales = 5000; // Replace with actual sales data if available
    const salesThisMonth = 20000; // Replace with actual sales data if available
    const salesGrowth = 15; // Replace with actual growth percentage if available

    res.json({
      totalUsers,
      totalReports,
      totalRequests,
      pendingRequests,
      totalContacts,
      unreadContacts,
      recentSales,
      salesThisMonth,
      salesGrowth,
      recentUsers,
      recentRequests,
      popularReports,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Error fetching dashboard data' });
  }
});

// Add a new endpoint to get PDF data
app.get('/api/reports/:id/pdf', verifyToken, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Check if user has purchased the report
        const user = await User.findById(req.user._id);
        if (!user.purchasedReports.includes(report._id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ pdfData: report.pdfData });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching PDF data' });
    }
});

// Endpoint to upload a PDF
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!req.file || req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        const report = new Report({
            title,
            description,
            pdf: {
                data: req.file.buffer,
                contentType: req.file.mimetype,
            },
        });

        await report.save();
        res.status(201).json({ message: 'PDF uploaded successfully', reportId: report._id });
    } catch (error) {
        console.error('Error uploading PDF:', error);
        res.status(500).json({ error: 'Error uploading PDF' });
    }
});

// Endpoint to serve a PDF by ID (supports inline preview or download)
app.get('/api/pdf/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report || !report.pdf || !report.pdf.data) {
            return res.status(404).json({ error: 'PDF not found' });
        }

        const { download } = req.query;
        const isDownload = download === '1' || download === 'true';

        const safeName = `${(report.title || 'report').replace(/[^a-z0-9_\-]+/gi, '_')}.pdf`;
        res.setHeader('Content-Type', report.pdf.contentType || 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `${isDownload ? 'attachment' : 'inline'}; filename="${safeName}"`
        );
        res.send(report.pdf.data);
    } catch (error) {
        console.error('Error fetching PDF:', error);
        res.status(500).json({ error: 'Error fetching PDF' });
    }
});
      
