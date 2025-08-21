import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    pdf: {
        data: Buffer, // Store PDF as binary data
        contentType: String, // MIME type of the PDF
    },
    uploadDate: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Report', reportSchema);
