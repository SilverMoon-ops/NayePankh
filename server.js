const dns = require('dns');
// Forces Node.js to use Google DNS for network resolutions
dns.setServers(['8.8.8.8', '8.8.4.4']); 

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// Middleware configuration
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Added to cleanly support JSON payloads if needed later

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secure-string-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Protects against XSS attacks
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        maxAge: 1000 * 60 * 60 * 24 // 24-hour session expiration
    }
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected safely to MongoDB Atlas'))
    .catch(err => console.error('❌ Database connection error:', err));

// User & Volunteer Registration Database Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['volunteer', 'admin'], default: 'volunteer' },
    skills: { type: String, default: '' },
    interestArea: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true }); // Tracks when volunteers registered/applied

const User = mongoose.model('User', userSchema);

// Middleware to protect routes based on authentication status
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.redirect('/dashboard');
    }
    next();
};

// Navigation & Auth Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Validation check
        if (!name || !email || !password) {
            return res.render('register', { error: 'All fields are required.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Explicitly set 'volunteer' role to prevent Privilege Escalation exploits
        await User.create({ 
            name, 
            email, 
            password: hashedPassword, 
            role: 'volunteer' 
        });
        
        res.redirect('/login');
    } catch (err) {
        res.render('register', { error: 'Email already exists or invalid details.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            req.session.role = user.role;
            req.session.userName = user.name;
            
            return user.role === 'admin' ? res.redirect('/admin') : res.redirect('/dashboard');
        }
        res.render('login', { error: 'Invalid email credentials or password.' });
    } catch (err) {
        res.render('login', { error: 'An unexpected authentication error occurred.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('❌ Session destruction error:', err);
        res.redirect('/login');
    });
});

// Volunteer Dashboard Routes
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect('/logout');
        res.render('dashboard', { user });
    } catch (err) {
        res.status(500).send('Internal Server Error');
    }
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.render('register', { error: 'All fields are required.' });
        }

        // 🔍 Check if a user with this email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.render('register', { error: 'This email is already registered. Please log in instead.' });
        }

        // If email is safe, hash password and create account
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ 
            name, 
            email: email.toLowerCase().trim(), 
            password: hashedPassword, 
            role: 'volunteer' 
        });
        
        res.redirect('/login');
    } catch (err) {
        console.error("Registration error:", err);
        res.render('register', { error: 'Invalid details or registration failed.' });
    }
});
// Admin Dashboard & Status Management Routes
app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const applicants = await User.find({ role: 'volunteer' }).lean(); // .lean() optimizes performance read-only queries
        
        // Core report metrics calculation
        const metrics = {
            total: applicants.length,
            approved: applicants.filter(a => a.status === 'Approved').length,
            pending: applicants.filter(a => a.status === 'Pending').length
        };
        
        res.render('admin', { applicants, metrics, userName: req.session.userName });
    } catch (err) {
        res.status(500).send('Error retrieving administrative data.');
    }
});

app.post('/admin/update-status', requireAdmin, async (req, res) => {
    try {
        const { id, status } = req.body;
        if (['Pending', 'Approved', 'Rejected'].includes(status)) {
            await User.findByIdAndUpdate(id, { status });
        }
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Failed to update volunteer status.');
    }
});

// Global Error Catching Middleware (Optional but highly recommended)
app.use((err, req, res, next) => {
    console.error('⚠️ Unhandled Application Error:', err.stack);
    res.status(500).send('Something went wrong on our end!');
});

// Start the Application Environment
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running dynamically on http://localhost:${PORT}`));