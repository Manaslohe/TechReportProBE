import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    price: { type: Number, required: true },
    duration: { type: Number, required: true }, // in months
    purchaseDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    reportsIncluded: { type: Number, required: true },
    reportsUsed: { type: Number, default: 0 },
    premiumReports: { type: Number, required: true },
    bluechipReports: { type: Number, required: true },
    premiumReportsUsed: { type: Number, default: 0 },
    bluechipReportsUsed: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Subscription Management
    currentSubscription: subscriptionSchema,
    subscriptionHistory: [subscriptionSchema],
    
    // Report Access
    purchasedReports: [{
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
        purchaseDate: { type: Date, default: Date.now },
        price: { type: Number, required: true },
        accessType: { 
            type: String, 
            enum: ['individual', 'subscription'], 
            default: 'individual' 
        }
    }],
    
    // Points/Credits System
    points: { type: Number, default: 0 },
    
    // Payment Requests
    paymentRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentRequest'
    }]
}, { timestamps: true });

// Method to check if user has active subscription
userSchema.methods.hasActiveSubscription = function() {
    if (!this.currentSubscription) return false;
    return this.currentSubscription.isActive && 
           this.currentSubscription.expiryDate > new Date();
};

// Method to get available reports count
userSchema.methods.getAvailableReports = function() {
    if (!this.hasActiveSubscription()) return { premium: 0, bluechip: 0 };
    
    const sub = this.currentSubscription;
    return {
        premium: Math.max(0, sub.premiumReports - sub.premiumReportsUsed),
        bluechip: Math.max(0, sub.bluechipReports - sub.bluechipReportsUsed),
        total: Math.max(0, sub.reportsIncluded - sub.reportsUsed)
    };
};

// Method to use a report
userSchema.methods.useReport = function(reportType = 'premium') {
    if (!this.hasActiveSubscription()) return false;
    
    const available = this.getAvailableReports();
    if (reportType === 'bluechip' && available.bluechip > 0) {
        this.currentSubscription.bluechipReportsUsed += 1;
        this.currentSubscription.reportsUsed += 1;
        return true;
    } else if (reportType === 'premium' && available.premium > 0) {
        this.currentSubscription.premiumReportsUsed += 1;
        this.currentSubscription.reportsUsed += 1;
        return true;
    }
    return false;
};

export default mongoose.model('User', userSchema);
