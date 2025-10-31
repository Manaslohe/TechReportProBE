import express from 'express';
import multer from 'multer';
import Report from '../models/Report.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer();

// Middleware to verify token (optional for some routes)
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// Middleware to require authentication
const requireAuth = (req, res, next) => {
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

// Check if user can access a report
const checkReportAccess = async (userId, reportId, reportType = 'premium') => {
    const user = await User.findById(userId);
    if (!user) return { hasAccess: false, reason: 'User not found' };

    // Check if user purchased this specific report
    const hasPurchased = user.purchasedReports.some(
        pr => pr.reportId.toString() === reportId
    );
    if (hasPurchased) {
        return { hasAccess: true, accessType: 'individual' };
    }

    // Check subscription access
    if (user.hasActiveSubscription()) {
        const availableReports = user.getAvailableReports();
        
        if (reportType === 'bluechip' && availableReports.bluechip > 0) {
            return { hasAccess: true, accessType: 'subscription', reportType: 'bluechip' };
        } else if (reportType === 'premium' && availableReports.premium > 0) {
            return { hasAccess: true, accessType: 'subscription', reportType: 'premium' };
        }
        
        return { hasAccess: false, reason: 'No reports left in subscription' };
    }

    return { hasAccess: false, reason: 'No active subscription or individual purchase' };
};

// Upload Report
router.post('/', upload.single('file'), async (req, res) => {
    const { originalname, mimetype, size } = req.file;
    const { title, description, sector, isFree, uploadDate } = req.body;

    // Validation
    if (!title || !description || !sector || !originalname || !mimetype || !size) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const validSectors = ['Technology', 'Banking', 'Healthcare', 'Energy', 'Market Analysis', 'FMCG', 'Auto'];
    if (!validSectors.includes(sector)) {
        return res.status(400).json({ error: 'Invalid sector selected' });
    }

    try {
        const newReport = new Report({
            title,
            description,
            sector,
            isFree: isFree === 'true' || isFree === true,
            uploadDate: uploadDate ? new Date(uploadDate) : new Date(), // Use provided date or default to now
            pdf: {
                data: req.file.buffer,
                contentType: mimetype,
                size,
                name: originalname
            }
        });

        await newReport.save();
        res.status(201).json({ message: 'Report uploaded successfully', report: newReport });
    } catch (error) {
        console.error('Error uploading report:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get All Reports
router.get('/', async (req, res) => {
    try {
        const reports = await Report.find();
        res.status(200).json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get All Reports with Filters and Sorting
router.get('/filtered', async (req, res) => {
    const { searchTerm, sector, sortBy, sortOrder } = req.query;

    try {
        const query = {};
        if (searchTerm) {
            query.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
            ];
        }
        if (sector && sector !== 'all') {
            query.sector = sector;
        }

        let sort = {};
        if (sortBy) {
            const order = sortOrder === 'asc' ? 1 : -1;
            if (sortBy === 'recent') sort.uploadDate = order;
            if (sortBy === 'name') sort.title = order;
        }

        const reports = await Report.find(query).sort(sort);
        res.status(200).json(reports);
    } catch (error) {
        console.error('Error fetching filtered reports:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Use Subscription to Access Report (MUST be before /:id/pdf route)
router.post('/:id/use-subscription', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ code: 'USER_NOT_FOUND', error: 'User not found' });
        }

        // Check if user has active subscription
        if (!user.hasActiveSubscription()) {
            return res.status(403).json({ 
                code: 'NO_SUBSCRIPTION', 
                error: 'No active subscription found' 
            });
        }

        // Check if report exists
        const report = await Report.findById(id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Check if already accessed this report via subscription
        const alreadyAccessed = user.purchasedReports.some(
            pr => pr.reportId.toString() === id && pr.accessType === 'subscription'
        );

        if (alreadyAccessed) {
            return res.status(400).json({ 
                code: 'ALREADY_ACCESSED', 
                error: 'You have already accessed this report' 
            });
        }

        // Check available reports and deduct
        const reportType = report.reportType || 'premium';
        const success = user.useReport(reportType);

        if (!success) {
            return res.status(403).json({ 
                code: 'NO_REPORTS_LEFT', 
                error: 'No reports left in your subscription' 
            });
        }

        // Add to purchased reports
        user.purchasedReports.push({
            reportId: id,
            purchaseDate: new Date(),
            price: 0,
            accessType: 'subscription'
        });

        await user.save();

        res.status(200).json({ 
            message: 'Report added successfully',
            report: {
                _id: report._id,
                title: report.title,
                description: report.description,
                sector: report.sector
            },
            remainingReports: user.getAvailableReports()
        });
    } catch (error) {
        console.error('Error using subscription:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Single Report with Access Check
router.get('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        const report = await Report.findById(id);

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // If report is free, allow access
        if (report.isFree) {
            return res.status(200).json({
                _id: report._id,
                title: report.title,
                description: report.description,
                sector: report.sector,
                uploadDate: report.uploadDate,
                reportType: report.reportType || 'premium',
                isFree: true,
                userAccess: { hasAccess: true, accessType: 'free' }
            });
        }

        // If user is authenticated, check their access
        let userAccess = { hasAccess: false };
        if (req.user) {
            userAccess = await checkReportAccess(req.user.id, id, report.reportType || 'premium');
        }

        // Return report with access information
        const reportData = {
            _id: report._id,
            title: report.title,
            description: report.description,
            sector: report.sector,
            uploadDate: report.uploadDate,
            reportType: report.reportType || 'premium',
            isFree: false,
            userAccess: userAccess
        };

        res.status(200).json(reportData);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Serve PDF with Access Control
router.get('/:id/pdf', async (req, res) => {
    const { id } = req.params;

    // Helper to extract token from header, query, or cookie
    const getToken = (req) => {
        // 1) Authorization header
        let t = req.header('Authorization');
        if (t && typeof t === 'string') {
            t = t.replace(/^Bearer\s+/i, '').trim();
            if (t) return t;
        }

        // 2) token query param (embed/iframe)
        const q = typeof req.query.token === 'string' ? req.query.token.trim() : '';
        if (q) {
            return q.replace(/^Bearer\s+/i, '').trim();
        }

        // 3) authToken cookie (if available)
        const rawCookie = req.headers.cookie || '';
        const cookies = Object.fromEntries(
            rawCookie.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, decodeURIComponent((v || []).join('='))];
            })
        );
        if (cookies.authToken) {
            return cookies.authToken.replace(/^Bearer\s+/i, '').trim();
        }

        return null;
    };

    try {
        const report = await Report.findById(id);

        if (!report || !report.pdf || !report.pdf.data) {
            return res.status(404).json({ error: 'Report not found or file missing' });
        }

        // If report is free, allow access without authentication
        if (report.isFree) {
            res.set({
                'Content-Type': report.pdf.contentType,
                'Content-Length': report.pdf.size,
                'Content-Disposition': `inline; filename="${report.pdf.name}"`,
            });
            return res.send(report.pdf.data);
        }

        // For paid reports, require authentication (via header, query token, or cookie)
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Access denied' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const access = await checkReportAccess(decoded.id, id, report.reportType || 'premium');
            
            if (!access.hasAccess) {
                return res.status(403).json({ 
                    code: 'ACCESS_DENIED', 
                    error: access.reason || 'You do not have access to this report',
                    reason: access.reason
                });
            }

            // If accessing via subscription, deduct report count
            if (access.accessType === 'subscription') {
                const user = await User.findById(decoded.id);
                const success = user.useReport(access.reportType);
                
                if (!success) {
                    return res.status(403).json({ 
                        code: 'NO_REPORTS_LEFT', 
                        error: 'No reports left in your subscription' 
                    });
                }

                user.purchasedReports.push({
                    reportId: id,
                    purchaseDate: new Date(),
                    price: 0,
                    accessType: 'subscription'
                });

                await user.save();
            }

            res.set({
                'Content-Type': report.pdf.contentType,
                'Content-Length': report.pdf.size,
                'Content-Disposition': `inline; filename="${report.pdf.name}"`,
            });

            res.send(report.pdf.data);
        } catch (error) {
            return res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Invalid token' });
        }
    } catch (error) {
        console.error('Error serving PDF:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Download PDF with Access Control
router.get('/:id/download', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const report = await Report.findById(id);

        if (!report || !report.pdf || !report.pdf.data) {
            return res.status(404).json({ error: 'Report not found or file missing' });
        }

        // Check access
        const access = await checkReportAccess(req.user.id, id, report.reportType || 'premium');
        
        if (!access.hasAccess) {
            return res.status(403).json({ 
                code: 'ACCESS_DENIED', 
                error: access.reason || 'You do not have access to this report' 
            });
        }

        // If accessing via subscription, deduct report count (if not already accessed)
        if (access.accessType === 'subscription') {
            const user = await User.findById(req.user.id);
            
            // Check if already accessed this report
            const alreadyAccessed = user.purchasedReports.some(
                pr => pr.reportId.toString() === id && pr.accessType === 'subscription'
            );

            if (!alreadyAccessed) {
                const success = user.useReport(access.reportType);
                
                if (!success) {
                    return res.status(403).json({ 
                        code: 'NO_REPORTS_LEFT', 
                        error: 'No reports left in your subscription' 
                    });
                }

                // Add to purchased reports for tracking
                user.purchasedReports.push({
                    reportId: id,
                    purchaseDate: new Date(),
                    price: 0, // Free via subscription
                    accessType: 'subscription'
                });

                await user.save();
            }
        }

        res.set({
            'Content-Type': report.pdf.contentType,
            'Content-Length': report.pdf.size,
            'Content-Disposition': `attachment; filename="${report.pdf.name}"`,
        });

        res.send(report.pdf.data);
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete Report
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await Report.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;