import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    sector: { 
        type: String, 
        required: true
    },
    reportType: {
        type: String,
        enum: ['premium', 'bluechip', 'free'],
        default: 'premium',
        required: true
    },
    pdf: {
        data: Buffer, // Store PDF as binary data
        contentType: String, // MIME type of the PDF
        size: Number,
        name: String
    },
    uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Report', reportSchema);
