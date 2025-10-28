import express from 'express';
import User from '../models/User.js';
import Report from '../models/Report.js';
import PaymentRequest from '../models/PaymentRequest.js';
import Contact from '../models/Contact.js';

const router = express.Router();

// Admin Dashboard Data
router.get('/dashboard', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalReports = await Report.countDocuments();
        const totalRequests = await PaymentRequest.countDocuments();
        const pendingRequests = await PaymentRequest.countDocuments({ status: 'pending' });
        const totalContacts = await Contact.countDocuments();
        const unreadContacts = await Contact.countDocuments({ isRead: false });

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
        const recentRequests = await PaymentRequest.find()
            .populate('user', 'firstName lastName')
            .populate('report', 'title')
            .sort({ createdAt: -1 })
            .limit(5);
        const popularReports = await Report.find().sort({ downloadCount: -1 }).limit(5);

        const last24h = {
            users: await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            reports: await Report.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            requests: await PaymentRequest.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            contacts: await Contact.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        };

        res.status(200).json({
            totalUsers,
            totalReports,
            totalRequests,
            pendingRequests,
            totalContacts,
            unreadContacts,
            recentUsers,
            recentRequests,
            popularReports,
            last24h,
        });
    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get All Users for Admin
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().populate('purchasedReports', 'title').populate('paymentRequests');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users for admin:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get All Contacts for Admin
router.get('/contacts', async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.status(200).json(contacts);
    } catch (error) {
        console.error('Error fetching contacts for admin:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
