const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

// User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    dob:      { type: Date,   required: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Register
router.post('/signup', async (req, res) => {
    const { username, email, dob, password } = req.body;
    if (!username || !email || !dob || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    // Check if user/email exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
    }
    // Hash password before saving!
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new User({ username, email, dob, password: hashedPassword });
    await user.save();
    res.json({ success: true });
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true });
});

module.exports = router; 