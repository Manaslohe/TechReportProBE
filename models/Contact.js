import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: false
  },
  country: {
    type: String,
    required: false
  },
  message: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;
