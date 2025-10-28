import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    sector: { 
        type: String, 
        required: true,
        enum: ['Technology', 'Banking', 'Healthcare', 'Energy', 'Market Analysis', 'FMCG', 'Auto']
    },
    reportType: {
        type: String,
        enum: ['premium', 'bluechip'],
        default: 'premium'
    },
    isFree: {
        type: Boolean,
        default: false
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
