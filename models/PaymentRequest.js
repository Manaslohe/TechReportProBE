import mongoose from 'mongoose';

const paymentRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment Type
  paymentType: {
    type: String,
    enum: ['report', 'subscription'],
    required: true
  },
  
  // For Individual Report Purchase
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: function() { return this.paymentType === 'report'; }
  },
  
  // For Subscription Purchase
  subscriptionPlan: {
    planId: {
      type: String,
      required: function() { return this.paymentType === 'subscription'; }
    },
    planName: {
      type: String,
      required: function() { return this.paymentType === 'subscription'; }
    },
    duration: {
      type: Number,
      required: function() { return this.paymentType === 'subscription'; }
    },
    reportsIncluded: {
      type: Number,
      required: function() { return this.paymentType === 'subscription'; }
    },
    premiumReports: {
      type: Number,
      required: function() { return this.paymentType === 'subscription'; }
    },
    bluechipReports: {
      type: Number,
      required: function() { return this.paymentType === 'subscription'; }
    }
  },
  
  amount: {
    type: Number,
    required: true
  },
  screenshotData: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminComment: {
    type: String,
    default: ''
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isAdminGrant: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.model('PaymentRequest', paymentRequestSchema);

