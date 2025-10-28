import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PaymentRequest from '../models/PaymentRequest.js';
import Report from '../models/Report.js'; // added

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

// User Signup
router.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ firstName, lastName, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'Error registering user' });
    }
});

// User Signin
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            token,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            },
        });
    } catch (error) {
        console.error('Error during signin:', error);
        res.status(500).json({ error: 'Error signing in' });
    }
});

// Get Purchased Reports
router.get('/purchased-reports', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // Fetch only purchasedReports to reduce payload
        const user = await User.findById(userId).select('purchasedReports').lean();

        if (!user) {
            return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found' });
        }

        const purchased = Array.isArray(user.purchasedReports) ? user.purchasedReports : [];
        const reportIds = purchased
            .map(pr => pr.reportId)
            .filter(id => !!id);

        if (reportIds.length === 0) {
            return res.json([]); // nothing purchased
        }

        // Fetch reports in one query
        const reports = await Report.find(
            { _id: { $in: reportIds } },
            'title sector uploadDate description isFree'
        ).lean();

        const reportMap = new Map(reports.map(r => [String(r._id), r]));

        // Build clean response; skip entries where report is missing (deleted)
        const result = purchased.reduce((acc, pr) => {
            const rep = reportMap.get(String(pr.reportId));
            if (!rep) return acc;
            acc.push({
                _id: rep._id,
                title: rep.title,
                sector: rep.sector,
                uploadDate: rep.uploadDate,
                description: rep.description,
                isFree: rep.isFree,
                purchaseDate: pr.purchaseDate,
                accessType: pr.accessType,
                price: pr.price
            });
            return acc;
        }, []);

        res.json(result);
    } catch (error) {
        console.error('Error fetching purchased reports:', error);
        res.status(500).json({ code: 'SERVER_ERROR', error: 'Internal server error' });
    }
});

// Get User Dashboard Data
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('purchasedReports.reportId', 'title sector uploadDate')
            .select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get pending payment requests
        const pendingRequests = await PaymentRequest.find({
            user: req.user.id,
            status: 'pending'
        }).populate('report', 'title sector');

        // Get subscription status
        const subscriptionStatus = {
            hasActive: user.hasActiveSubscription(),
            current: user.currentSubscription,
            availableReports: user.getAvailableReports(),
            history: user.subscriptionHistory
        };

        // Prepare dashboard data
        const dashboardData = {
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                points: user.points,
                joinDate: user.createdAt
            },
            subscription: subscriptionStatus,
            purchasedReports: user.purchasedReports,
            pendingRequests: pendingRequests.map(req => ({
                _id: req._id,
                paymentType: req.paymentType,
                amount: req.amount,
                status: req.status,
                createdAt: req.createdAt,
                report: req.report,
                subscriptionPlan: req.subscriptionPlan
            })),
            stats: {
                totalReportsAccessed: user.purchasedReports.length,
                totalSpent: user.purchasedReports.reduce((sum, pr) => sum + pr.price, 0),
                pendingPayments: pendingRequests.length
            }
        };

        res.status(200).json(dashboardData);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User Subscription Status
router.get('/subscription', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const subscriptionData = {
            hasActive: user.hasActiveSubscription(),
            current: user.currentSubscription,
            availableReports: user.getAvailableReports(),
            expiryDate: user.currentSubscription?.expiryDate,
            daysLeft: user.currentSubscription 
                ? Math.max(0, Math.ceil((new Date(user.currentSubscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)))
                : 0
        };

        res.status(200).json(subscriptionData);
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User's Payment Requests
router.get('/payment-requests', verifyToken, async (req, res) => {
    try {
        const paymentRequests = await PaymentRequest.find({ user: req.user.id })
            .populate('report', 'title sector')
            .sort({ createdAt: -1 });

        res.status(200).json(paymentRequests);
    } catch (error) {
        console.error('Error fetching payment requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check Report Access
router.get('/check-access/:reportId', verifyToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user purchased this specific report
        const hasPurchased = user.purchasedReports.some(
            pr => pr.reportId.toString() === reportId
        );

        let accessInfo = {
            hasAccess: hasPurchased,
            accessType: hasPurchased ? 'individual' : null,
            reason: hasPurchased ? 'Purchased individually' : null
        };

        // If not purchased individually, check subscription
        if (!hasPurchased && user.hasActiveSubscription()) {
            const availableReports = user.getAvailableReports();
            
            if (availableReports.total > 0) {
                accessInfo = {
                    hasAccess: true,
                    accessType: 'subscription',
                    availableReports: availableReports,
                    reason: 'Available via subscription'
                };
            } else {
                accessInfo.reason = 'No reports left in subscription';
            }
        } else if (!hasPurchased && !user.hasActiveSubscription()) {
            accessInfo.reason = 'No active subscription or individual purchase';
        }

        res.status(200).json(accessInfo);
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;