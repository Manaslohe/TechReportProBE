import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    purchasedReports: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report'
    }],
    paymentRequests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentRequest'
    }]
}, { timestamps: true });

export default mongoose.model('User', userSchema);
