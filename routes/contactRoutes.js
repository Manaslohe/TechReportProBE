import express from 'express';
import Contact from '../models/Contact.js';

const router = express.Router();

// Submit Contact Form
router.post('/', async (req, res) => {
    const { name, email, phone, message } = req.body;

    try {
        // Basic validation
        if (!name || !email || !phone || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Create a new contact message
        const newContact = new Contact({
            name,
            email,
            phone,
            message
        });

        // Save to database
        await newContact.save();

        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error saving contact message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin: Get All Contacts
router.get('/admin', async (req, res) => {
    try {
        // Fetch all contact messages from the database
        const contacts = await Contact.find();

        res.status(200).json(contacts);
    } catch (error) {
        console.error('Error fetching contact messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;