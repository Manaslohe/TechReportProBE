import express from 'express';
import PaymentRequest from '../models/PaymentRequest.js';
import User from '../models/User.js';
import Report from '../models/Report.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    console.log('🔐 [PAYMENT] Auth check:', {
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 10)}...` : 'none',
        headers: Object.keys(req.headers)
    });
    
    if (!token) {
        console.log('❌ [PAYMENT] No token provided');
        return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Access denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ [PAYMENT] Token verified for user:', decoded.id);
        req.user = decoded;
        next();
    } catch (error) {
        console.log('❌ [PAYMENT] Token verification failed:', error.message);
        res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Invalid token' });
    }
};

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const isAdmin = req.header('x-admin-auth') === 'true';
    
    console.log('🔐 [ADMIN-PAYMENT] Auth check:', {
        hasToken: !!token,
        isAdmin,
        tokenPreview: token ? `${token.substring(0, 10)}...` : 'none'
    });
    
    if (!token || !isAdmin) {
        console.log('❌ [ADMIN-PAYMENT] Admin authentication required');
        return res.status(401).json({ code: 'ADMIN_AUTH_REQUIRED', error: 'Admin access denied' });
    }

    // For admin requests, we'll validate the token format instead of JWT verification
    try {
        // Simple validation - check if token exists and admin flag is set
        // In production, implement proper admin session management
        if (token && isAdmin) {
            console.log('✅ [ADMIN-PAYMENT] Admin access granted');
            req.isAdmin = true;
            next();
        } else {
            throw new Error('Invalid admin credentials');
        }
    } catch (error) {
        console.log('❌ [ADMIN-PAYMENT] Authentication failed:', error.message);
        res.status(401).json({ code: 'AUTH_FAILED', error: 'Invalid admin credentials' });
    }
};

// Create Payment Request
router.post('/payment-requests', verifyToken, async (req, res) => {
    console.log('💰 [PAYMENT] Creating payment request for user:', req.user.id);
    console.log('   → Payment type:', req.body.paymentType);
    console.log('   → Amount:', req.body.amount);
    
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

// Get All Payment Requests (Admin Only)
router.get('/payment-requests', verifyAdminToken, async (req, res) => {
    console.log('📋 [ADMIN-PAYMENT] Fetching all payment requests');
    
    try {
        const paymentRequests = await PaymentRequest.find()
            .populate('user', 'firstName lastName email')
            .populate('report', 'title sector')
            .sort({ createdAt: -1 });

        console.log(`✅ [ADMIN-PAYMENT] Found ${paymentRequests.length} payment requests`);
        res.status(200).json(paymentRequests);
    } catch (error) {
        console.error('❌ [ADMIN-PAYMENT] Error fetching payment requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;