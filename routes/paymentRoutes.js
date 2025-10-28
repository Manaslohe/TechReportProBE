import express from 'express';
import PaymentRequest from '../models/PaymentRequest.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Access denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Invalid token' });
    }
};

// Create Payment Request
router.post('/payment-requests', verifyToken, async (req, res) => {
    const { paymentType, reportId, subscriptionPlan, amount, screenshotData } = req.body;

    if (!paymentType || !amount || !screenshotData) {
        return res.status(400).json({ code: 'MISSING_FIELDS', error: 'All fields are required' });
    }

    if (!screenshotData) {
        return res.status(400).json({ code: 'SCREENSHOT_REQUIRED', error: 'Payment screenshot is required' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found' });
        }

        // Validation based on payment type
        if (paymentType === 'report') {
            if (!reportId) {
                return res.status(400).json({ error: 'Report ID is required for report purchase' });
            }

            const report = await Report.findById(reportId);
            if (!report) {
                return res.status(404).json({ code: 'ITEM_NOT_FOUND', error: 'Report not found' });
            }

            // Check if user already purchased this report
            const alreadyPurchased = user.purchasedReports.some(
                pr => pr.reportId.toString() === reportId
            );
            if (alreadyPurchased) {
                return res.status(400).json({ code: 'ALREADY_PURCHASED', error: 'Report already purchased' });
            }

            // Check for pending request
            const pendingRequest = await PaymentRequest.findOne({
                user: req.user.id,
                report: reportId,
                status: 'pending'
            });
            if (pendingRequest) {
                return res.status(400).json({ code: 'DUPLICATE_REQUEST', error: 'Pending request already exists' });
            }

        } else if (paymentType === 'subscription') {
            if (!subscriptionPlan) {
                return res.status(400).json({ error: 'Subscription plan details are required' });
            }

            // Check if user has active subscription
            if (user.hasActiveSubscription()) {
                return res.status(400).json({ code: 'ACTIVE_SUBSCRIPTION', error: 'You already have an active subscription' });
            }

            // Check for pending subscription request
            const pendingRequest = await PaymentRequest.findOne({
                user: req.user.id,
                paymentType: 'subscription',
                status: 'pending'
            });
            if (pendingRequest) {
                return res.status(400).json({ code: 'DUPLICATE_REQUEST', error: 'Pending subscription request already exists' });
            }
        }

        const paymentRequest = new PaymentRequest({
            user: req.user.id,
            paymentType,
            ...(paymentType === 'report' && { report: reportId }),
            ...(paymentType === 'subscription' && { subscriptionPlan }),
            amount,
            screenshotData,
            status: 'pending'
        });

        await paymentRequest.save();
        res.status(201).json(paymentRequest);
    } catch (error) {
        console.error('Error creating payment request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify Payment Request (Admin)
router.post('/payment-requests/:id/verify', async (req, res) => {
    const { id } = req.params;
    const { status, adminComment } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    try {
        const paymentRequest = await PaymentRequest.findById(id).populate('user');
        if (!paymentRequest) {
            return res.status(404).json({ error: 'Payment request not found' });
        }

        paymentRequest.status = status;
        paymentRequest.adminComment = adminComment || '';
        paymentRequest.reviewedAt = new Date();
        await paymentRequest.save();

        // If approved, update user data
        if (status === 'approved') {
            const user = paymentRequest.user;

            if (paymentRequest.paymentType === 'report') {
                // Add report to user's purchased reports
                user.purchasedReports.push({
                    reportId: paymentRequest.report,
                    purchaseDate: new Date(),
                    price: paymentRequest.amount,
                    accessType: 'individual'
                });
                
                // Add points (optional reward system)
                user.points += 10;

            } else if (paymentRequest.paymentType === 'subscription') {
                const planData = paymentRequest.subscriptionPlan;
                const now = new Date();
                const expiryDate = new Date(now);
                expiryDate.setMonth(now.getMonth() + planData.duration);

                // Move current subscription to history if exists
                if (user.currentSubscription) {
                    user.subscriptionHistory.push(user.currentSubscription);
                }

                // Set new subscription
                user.currentSubscription = {
                    planId: planData.planId,
                    planName: planData.planName,
                    price: paymentRequest.amount,
                    duration: planData.duration,
                    purchaseDate: now,
                    expiryDate: expiryDate,
                    isActive: true,
                    reportsIncluded: planData.reportsIncluded,
                    reportsUsed: 0,
                    premiumReports: planData.premiumReports,
                    bluechipReports: planData.bluechipReports,
                    premiumReportsUsed: 0,
                    bluechipReportsUsed: 0
                };

                // Add bonus points for subscription
                user.points += planData.duration * 20;
            }

            await user.save();
        }

        res.status(200).json(paymentRequest);
    } catch (error) {
        console.error('Error verifying payment request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get All Payment Requests
router.get('/payment-requests', verifyToken, async (req, res) => {
    try {
        const paymentRequests = await PaymentRequest.find()
            .populate('user', 'firstName lastName email')
            .populate('report', 'title');

        res.status(200).json(paymentRequests);
    } catch (error) {
        console.error('Error fetching payment requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;