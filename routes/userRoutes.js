import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Report from '../models/Report.js';
import PaymentRequest from '../models/PaymentRequest.js'; // ADD this import
import { sendWelcomeEmail, sendOTPEmail, sendPasswordResetSuccessEmail } from '../services/emailService.js';

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

        // Remove manual hashing - the User model pre-save hook will handle it
        const newUser = new User({ firstName, lastName, email, password }); // CHANGED: removed bcrypt.hash
        await newUser.save();

        // Send welcome email with better error handling
        console.log('📧 [SIGNUP] Attempting to send welcome email to:', email);
        sendWelcomeEmail({ 
            email, 
            firstName, 
            lastName 
        }).then(() => {
            console.log('✅ [SIGNUP] Welcome email queued successfully');
        }).catch(err => {
            console.error('❌ [SIGNUP] Failed to send welcome email:', err.message);
            console.error('   → Error code:', err.code);
            console.error('   → Error details:', err);
        });

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
        const user = await User.findById(userId).select('purchasedReports').lean();

        if (!user) {
            return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found' });
        }

        const purchased = Array.isArray(user.purchasedReports) ? user.purchasedReports : [];
        const reportIds = purchased
            .map(pr => pr.reportId)
            .filter(id => !!id);

        if (reportIds.length === 0) {
            return res.json([]);
        }

        const reports = await Report.find(
            { _id: { $in: reportIds } },
            'title sector uploadDate description isFree'
        ).lean();

        const reportMap = new Map(reports.map(r => [String(r._id), r]));

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

        // Check and update expired subscription
        const hasActive = user.hasActiveSubscription();
        if (!hasActive && user.currentSubscription && !user.currentSubscription.isActive) {
            await user.save(); // Save the deactivated subscription
        }

        // Get pending payment requests
        const pendingRequests = await PaymentRequest.find({
            user: req.user.id,
            status: 'pending'
        }).populate('report', 'title sector');

        // Get subscription status with expiry check
        const subscriptionStatus = {
            hasActive: hasActive,
            current: user.currentSubscription,
            availableReports: hasActive ? user.getAvailableReports() : { total: 0, premium: 0, bluechip: 0 },
            history: user.subscriptionHistory,
            isExpired: user.currentSubscription && !hasActive
        };

        // Prepare dashboard data
        const dashboardData = {
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
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

        const hasActive = user.hasActiveSubscription();
        
        // Save if subscription was deactivated
        if (!hasActive && user.currentSubscription && !user.currentSubscription.isActive) {
            await user.save();
        }

        const subscriptionData = {
            hasActive: hasActive,
            current: user.currentSubscription,
            availableReports: hasActive ? user.getAvailableReports() : { total: 0, premium: 0, bluechip: 0 },
            expiryDate: user.currentSubscription?.expiryDate,
            daysLeft: user.currentSubscription && hasActive
                ? Math.max(0, Math.ceil((new Date(user.currentSubscription.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)))
                : 0,
            isExpired: user.currentSubscription && !hasActive
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

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000;

        user.resetPasswordOTP = otp;
        user.resetPasswordExpires = otpExpiry;
        
        await user.save({ validateBeforeSave: false });

        console.log('📧 [FORGOT-PASSWORD] Generated OTP:', otp, 'for:', email);
        
        // Send OTP email with better error handling
        sendOTPEmail({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            otp
        }).then(() => {
            console.log('✅ [FORGOT-PASSWORD] OTP email queued successfully');
        }).catch(err => {
            console.error('❌ [FORGOT-PASSWORD] Failed to send OTP email:', err.message);
            console.error('   → Error code:', err.code);
            console.error('   → Error details:', err);
        });

        res.status(200).json({ message: 'OTP sent to email' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        
        console.log('Verifying OTP:', { email, otp, type: typeof otp }); // Debug log
        
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        const user = await User.findOne({
            email,
            resetPasswordExpires: { $gt: Date.now() }
        });

        console.log('Found user:', user ? 'Yes' : 'No'); // Debug log
        if (user) {
            console.log('Stored OTP:', user.resetPasswordOTP, 'Received OTP:', otp); // Debug log
            console.log('OTP Match:', user.resetPasswordOTP === String(otp)); // Debug log
            console.log('Expiry valid:', user.resetPasswordExpires > Date.now()); // Debug log
        }

        if (!user) {
            return res.status(400).json({ error: 'User not found or OTP expired' });
        }

        // Convert both to strings and trim for comparison
        if (String(user.resetPasswordOTP).trim() !== String(otp).trim()) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        console.log('Reset password request:', { email, otp, hasPassword: !!newPassword });
        
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const user = await User.findOne({
            email,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'User not found or OTP expired' });
        }

        if (String(user.resetPasswordOTP).trim() !== String(otp).trim()) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        user.password = newPassword;
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpires = undefined;
        
        await user.save();

        console.log('📧 [RESET-PASSWORD] Sending success email to:', email);

        sendPasswordResetSuccessEmail({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        }).then(() => {
            console.log('✅ [RESET-PASSWORD] Success email queued');
        }).catch(err => {
            console.error('❌ [RESET-PASSWORD] Failed to send success email:', err.message);
            console.error('   → Error code:', err.code);
            console.error('   → Error details:', err);
        });

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get All Users (Admin Only) - ADD THIS NEW ROUTE
router.get('/admin/all-users', async (req, res) => {
    try {
        // Verify admin access
        const isAdmin = req.header('x-admin-auth') === 'true';
        if (!isAdmin) {
            return res.status(401).json({ error: 'Admin access required' });
        }

        const users = await User.find()
            .select('-password -resetPasswordOTP -resetPasswordExpires')
            .lean();

        // Manually populate purchased reports
        const usersWithReports = await Promise.all(
            users.map(async (user) => {
                // Populate purchased reports
                if (user.purchasedReports && user.purchasedReports.length > 0) {
                    const reportIds = user.purchasedReports.map(pr => pr.reportId).filter(id => id);
                    const reports = await Report.find({ _id: { $in: reportIds } })
                        .select('title sector uploadDate description')
                        .lean();
                    
                    const reportMap = new Map(reports.map(r => [r._id.toString(), r]));
                    
                    user.purchasedReports = user.purchasedReports.map(pr => ({
                        _id: pr._id,
                        reportId: pr.reportId,
                        title: reportMap.get(pr.reportId?.toString())?.title || 'Unknown Report',
                        sector: reportMap.get(pr.reportId?.toString())?.sector || 'N/A',
                        uploadDate: reportMap.get(pr.reportId?.toString())?.uploadDate,
                        description: reportMap.get(pr.reportId?.toString())?.description,
                        purchaseDate: pr.purchaseDate,
                        price: pr.price,
                        accessType: pr.accessType
                    }));
                }

                // Fetch payment requests for this user
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
                    report: pr.report || { title: pr.subscriptionPlan?.planName || 'Subscription' },
                    subscriptionPlan: pr.subscriptionPlan
                }));

                return user;
            })
        );

        res.status(200).json(usersWithReports);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;