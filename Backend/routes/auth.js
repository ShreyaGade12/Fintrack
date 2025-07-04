// routes/auth.js
const express = require('express');
const router = express.Router();
const { User } = require('../db'); // Import the Sequelize User model from db.js
const jwt = require('jsonwebtoken');
const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Path to your middleware

// --- Registration Route ---
router.post('/register', async (req, res) => {
  const { name, email, password, firebaseUid } = req.body;

  try {
    // Check if user already exists in your DB with this Firebase UID or email
    let user = await User.findOne({ where: { firebaseUid: firebaseUid } });
    if (user) {
      return res.status(400).json({ message: 'User with that Firebase UID already exists.' });
    }
    user = await User.findOne({ where: { email: email } });
    if (user) {
        return res.status(400).json({ message: 'User with that email already exists.' });
    }

    // Create new user in your PostgreSQL database using Sequelize
    user = await User.create({ name, email, password, firebaseUid });

    // Generate your own JWT for this user for future backend API calls
    const token = jwt.sign({ id: user.id, firebaseUid: user.firebaseUid }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ message: 'User registered successfully', user: { id: user.id, email: user.email, firebaseUid: user.firebaseUid }, token });
  } catch (error) {
    console.error('Backend registration error:', error);
    // Handle Sequelize validation errors specifically
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.errors ? error.errors.map(e => e.message).join(', ') : error.message
      });
    }
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

// --- Login Route ---
// This route uses the verifyFirebaseToken middleware to ensure the Firebase ID token is valid.
router.post('/login', verifyFirebaseToken, async (req, res) => {
  // If verifyFirebaseToken middleware passes, req.firebaseUser will be available
  const { email, password, firebaseUid } = req.body; // These are sent from frontend, but primary verification is via token

  try {
    // Ensure the Firebase UID from the token matches the one sent (optional, but good for consistency)
    if (req.firebaseUser.uid !== firebaseUid) {
        return res.status(403).json({ message: 'Firebase UID mismatch.' });
    }

    // Find user in your PostgreSQL database using Sequelize
    const user = await User.findOne({ where: { firebaseUid: req.firebaseUser.uid } });

    if (!user) {
      // This case should ideally not happen if registration worked correctly.
      // It means a Firebase user exists but no corresponding backend user.
      return res.status(404).json({ message: 'User not found in backend database. Please register.' });
    }

    // Optional: If you still want to verify email/password against your DB (redundant if Firebase handles it for primary auth)
    // const isMatch = await user.comparePassword(password);
    // if (!isMatch) {
    //   return res.status(401).json({ message: 'Invalid credentials.' });
    // }

    // Generate your own JWT for this user for future backend API calls
    const token = jwt.sign({ id: user.id, firebaseUid: user.firebaseUid }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({ message: 'Login successful', user: { id: user.id, email: user.email, firebaseUid: user.firebaseUid }, token });

  } catch (error) {
    console.error('Backend login error:', error);
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
});

module.exports = router;
