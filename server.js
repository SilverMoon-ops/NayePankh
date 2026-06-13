const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secure-string-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// ─── MongoDB Connection ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ Database connection error:', err));

// ─── Schema ───────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:     { type: String, required: true },
    role:         { type: String, enum: ['volunteer', 'admin'], default: 'volunteer' },
    skills:       { type: String, default: '' },
    interestArea: { type: String, default: '' },
    status:       { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

// FIX 1: requireAdmin now verifies the role from the DB, not just the session.
// This prevents stale session data from granting admin access if a role changes.
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) return res.redirect('/login');
        const user = await User.findById(req.session.userId).lean();
        if (!user || user.role !== 'admin') return res.redirect('/dashboard');
        next();
    } catch (err) {
        console.error('❌ Admin auth error:', err);
        res.redirect('/login');
    }
};

// ─── Routes: Navigation ───────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login',    (req, res) => res.render('login',    { error: null }));
app.get('/register', (req, res) => res.render('register', { error: null }));

// ─── Routes: Register ─────────────────────────────────────────────────────────
// FIX 2: Removed the duplicate /register POST route. This single handler merges
// both versions, keeping the better duplicate-email check and try/catch from both.
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // FIX 3: Type-check inputs to guard against NoSQL injection via object payloads.
        if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
            return res.render('register', { error: 'Invalid input.' });
        }

        if (!name.trim() || !email.trim() || !password) {
            return res.render('register', { error: 'All fields are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check for duplicate email before attempting to insert
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.render('register', { error: 'This email is already registered. Please log in instead.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Role is explicitly hardcoded to 'volunteer' to prevent privilege escalation
        await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: 'volunteer'
        });

        res.redirect('/login');
    } catch (err) {
        console.error('❌ Registration error:', err);
        res.render('register', { error: 'Registration failed. Please try again.' });
    }
});

// ─── Routes: Login ────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // FIX 4: Type-check inputs to block NoSQL injection (e.g. sending email as { $gt: "" })
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.render('login', { error: 'Invalid input.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId   = user._id;
            req.session.role     = user.role;
            req.session.userName = user.name;

            return user.role === 'admin'
                ? res.redirect('/admin')
                : res.redirect('/dashboard');
        }

        res.render('login', { error: 'Invalid email or password.' });
    } catch (err) {
        console.error('❌ Login error:', err);
        res.render('login', { error: 'An unexpected error occurred.' });
    }
});

// ─── Routes: Logout ───────────────────────────────────────────────────────────
// FIX 5: Changed to POST to prevent CSRF-based logout attacks (a GET logout
// can be triggered by a third-party site via a hidden <img> or <a> tag).
// Update your EJS logout button to: <form method="POST" action="/logout">
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('❌ Session destruction error:', err);
        res.redirect('/login');
    });
});

// ─── Routes: Volunteer Dashboard ──────────────────────────────────────────────
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect('/logout');
        res.render('dashboard', { user });
    } catch (err) {
        console.error('❌ Dashboard error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// ─── Routes: Admin Dashboard ──────────────────────────────────────────────────
app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const applicants = await User.find({ role: 'volunteer' }).lean();

        const metrics = {
            total:    applicants.length,
            approved: applicants.filter(a => a.status === 'Approved').length,
            pending:  applicants.filter(a => a.status === 'Pending').length
        };

        res.render('admin', { applicants, metrics, userName: req.session.userName });
    } catch (err) {
        console.error('❌ Admin dashboard error:', err);
        res.status(500).send('Error retrieving administrative data.');
    }
});

app.post('/admin/update-status', requireAdmin, async (req, res) => {
    try {
        const { id, status } = req.body;

        // Whitelist check prevents arbitrary status values being written to DB
        if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).send('Invalid status value.');
        }

        await User.findByIdAndUpdate(id, { status });
        res.redirect('/admin');
    } catch (err) {
        console.error('❌ Status update error:', err);
        res.status(500).send('Failed to update volunteer status.');
    }
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('⚠️ Unhandled Application Error:', err.stack);
    res.status(500).send('Something went wrong on our end!');
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));