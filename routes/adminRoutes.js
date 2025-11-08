import express from 'express';
import User from '../models/User.js';
import Report from '../models/Report.js';
import PaymentRequest from '../models/PaymentRequest.js';
import Contact from '../models/Contact.js';
import { sendPurchaseApprovalEmail } from '../services/emailService.js';
import { sendAdminNotification } from '../services/adminNotificationService.js'; // ADD

const router = express.Router();

// Middleware to verify admin
const verifyAdmin = (req, res, next) => {
    const isAdmin = req.header('x-admin-auth') === 'true';
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token || !isAdmin) {
        return res.status(401).json({ error: 'Admin access required' });
    }
    next();
};

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
router.get('/users', verifyAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -resetPasswordOTP -resetPasswordExpires')
            .lean();

        const usersWithDetails = await Promise.all(
            users.map(async (user) => {
                // Populate purchased reports with full details
                if (user.purchasedReports && user.purchasedReports.length > 0) {
                    const reportIds = user.purchasedReports.map(pr => pr.reportId).filter(id => id);
                    const reports = await Report.find({ _id: { $in: reportIds } })
                        .select('title sector uploadDate description reportType')
                        .lean();
                    
                    const reportMap = new Map(reports.map(r => [r._id.toString(), r]));
                    
                    user.purchasedReports = user.purchasedReports.map(pr => {
                        const report = reportMap.get(pr.reportId?.toString());
                        return {
                            _id: pr._id || pr.reportId,
                            reportId: pr.reportId,
                            title: report?.title || 'Unknown Report',
                            sector: report?.sector || 'N/A',
                            uploadDate: report?.uploadDate,
                            description: report?.description,
                            reportType: report?.reportType || 'premium',
                            purchaseDate: pr.purchaseDate,
                            price: pr.price,
                            accessType: pr.accessType
                        };
                    });
                } else {
                    user.purchasedReports = [];
                }

                // Fetch and populate payment requests
                const paymentRequests = await PaymentRequest.find({ user: user._id })
                    .populate('report', 'title sector')
                    .select('paymentType amount status createdAt report subscriptionPlan')
                    .sort({ createdAt: -1 })
                    .lean();

                user.paymentRequests = paymentRequests.map(pr => ({
                    _id: pr._id,
                    paymentType: pr.paymentType,
                    amount: pr.amount,
                    status: pr.status,
                    createdAt: pr.createdAt,
                    report: pr.report || { 
                        title: pr.subscriptionPlan?.planName || 'Subscription Plan',
                        sector: 'Subscription'
                    },
                    subscriptionPlan: pr.subscriptionPlan
                }));

                return user;
            })
        );

        res.status(200).json(usersWithDetails);
    } catch (error) {
        console.error('Error fetching users for admin:', error);
        res.status(500).json({ error: 'Internal server error' });
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

// Approve Payment Request
router.patch('/payment-requests/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const paymentRequest = await PaymentRequest.findById(id)
            .populate('user', 'firstName lastName email')
            .populate('report', 'title')
            .populate('subscriptionPlan', 'planName');

        if (!paymentRequest) {
            return res.status(404).json({ error: 'Payment request not found' });
        }

        if (paymentRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Payment request already processed' });
        }

        const user = await User.findById(paymentRequest.user._id || paymentRequest.user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        paymentRequest.status = 'approved';
        paymentRequest.approvedAt = new Date();
        await paymentRequest.save();

        if (paymentRequest.paymentType === 'subscription') {
            const plan = paymentRequest.subscriptionPlan;
            user.activateSubscription(plan);
            await user.save();

            // Send approval email with subscription details
            sendPurchaseApprovalEmail({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                purchaseType: 'Subscription',
                itemName: plan.planName,
                amount: paymentRequest.amount,
                subscriptionDetails: {
                    duration: plan.duration,
                    totalReports: plan.reportsIncluded,
                    premiumReports: plan.premiumReports,
                    bluechipReports: plan.bluechipReports,
                    expiryDate: user.currentSubscription?.expiryDate
                }
            }).catch(err => {
                console.error('Failed to send purchase approval email:', err);
            });

        } else if (paymentRequest.paymentType === 'individual') {
            user.purchasedReports.push({
                reportId: paymentRequest.report._id || paymentRequest.report,
                purchaseDate: new Date(),
                price: paymentRequest.amount,
                accessType: 'individual'
            });
            await user.save();

            // Send approval email for individual report
            sendPurchaseApprovalEmail({
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                purchaseType: 'Individual Report',
                itemName: paymentRequest.report.title || 'Report',
                amount: paymentRequest.amount
            }).catch(err => {
                console.error('Failed to send purchase approval email:', err);
            });
        }

        res.status(200).json({ 
            message: 'Payment request approved successfully',
            paymentRequest 
        });
    } catch (error) {
        console.error('Error approving payment request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send notification to user about their payment request status
router.post('/payment-requests/:id/notify', async (req, res) => {
    try {
        const { id } = req.params;
        
        const paymentRequest = await PaymentRequest.findById(id)
            .populate('user', 'firstName lastName email')
            .populate('report', 'title')
            .populate('subscriptionPlan', 'planName');

        if (!paymentRequest) {
            return res.status(404).json({ error: 'Payment request not found' });
        }

        if (paymentRequest.status === 'pending') {
            return res.status(400).json({ error: 'Cannot notify for pending requests' });
        }

        const user = paymentRequest.user;
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Determine purchase type and item name
        const purchaseType = paymentRequest.paymentType === 'subscription' ? 'subscription' : 'report';
        const itemName = purchaseType === 'subscription' 
            ? paymentRequest.subscriptionPlan?.planName || 'Subscription Plan'
            : paymentRequest.report?.title || 'Report';

        // Send notification email
        await sendAdminNotification({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            status: paymentRequest.status,
            purchaseType,
            itemName,
            amount: paymentRequest.amount,
            requestId: paymentRequest._id,
            adminComment: paymentRequest.adminComment || ''
        });

        res.status(200).json({ 
            message: 'Notification sent successfully',
            notificationSent: true
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Admin Grant Access - Create payment request on behalf of user (pending approval)
router.post('/grant-access', verifyAdmin, async (req, res) => {
    try {
        const { userId, paymentType, reportId, subscriptionPlan, amount, screenshotData, isAdminGrant } = req.body;

        if (!userId || !paymentType || !amount || !screenshotData) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Validation based on payment type
        if (paymentType === 'report') {
            if (!reportId) {
                return res.status(400).json({ error: 'Report ID is required' });
            }

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Check if already purchased
            const alreadyPurchased = user.purchasedReports.some(
                pr => pr.reportId.toString() === reportId
            );
            if (alreadyPurchased) {
                return res.status(400).json({ error: 'User already has access to this report' });
            }

            // Check for pending request
            const pendingRequest = await PaymentRequest.findOne({
                user: userId,
                report: reportId,
                status: 'pending'
            });
            if (pendingRequest) {
                return res.status(400).json({ error: 'Pending request already exists for this report' });
            }

        } else if (paymentType === 'subscription') {
            if (!subscriptionPlan) {
                return res.status(400).json({ error: 'Subscription plan is required' });
            }

            if (user.hasActiveSubscription()) {
                return res.status(400).json({ error: 'User already has an active subscription' });
            }

            // Check for pending subscription request
            const pendingRequest = await PaymentRequest.findOne({
                user: userId,
                paymentType: 'subscription',
                status: 'pending'
            });
            if (pendingRequest) {
                return res.status(400).json({ error: 'Pending subscription request already exists' });
            }
        }

        // Create payment request (pending status - requires approval)
        const paymentRequest = new PaymentRequest({
            user: userId,
            paymentType,
            ...(paymentType === 'report' && { report: reportId }),
            ...(paymentType === 'subscription' && { subscriptionPlan }),
            amount,
            screenshotData,
            status: 'pending',
            isAdminGrant: true
        });

        await paymentRequest.save();

        res.status(201).json({
            message: 'Access request submitted for approval',
            paymentRequest
        });
    } catch (error) {
        console.error('Error creating access request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
