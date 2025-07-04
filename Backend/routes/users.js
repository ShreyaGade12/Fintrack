// routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Assuming User.js is in Backend/models/User.js
const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware

// Protect all user routes
router.use(verifyFirebaseToken);

// GET user settings (for the Settings page)
// This endpoint fetches the user's preferences and integrations data.
router.get('/settings/:userId', async (req, res) => {
  try {
    // Ensure the requested userId from params matches the authenticated Firebase UID
    if (req.params.userId !== req.firebaseUser.uid) {
      return res.status(403).json({ message: 'Unauthorized access to user settings.' });
    }

    // Find the user by their Firebase UID and select only the preferences and integrations fields
    const user = await User.findOne({ firebaseUid: req.firebaseUser.uid }).select('preferences integrations');
    if (!user) {
      return res.status(404).json({ message: 'User settings not found.' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Server error fetching user settings.', error: error.message });
  }
});

// PUT (Update) user settings (for the Settings page)
// This endpoint allows updating user preferences and integration settings.
router.put('/settings', async (req, res) => {
  const { integrations, preferences, userId } = req.body;

  // Ensure the requested userId from body matches the authenticated Firebase UID
  if (userId !== req.firebaseUser.uid) {
    return res.status(403).json({ message: 'Unauthorized: User ID mismatch.' });
  }

  try {
    // Find the user by Firebase UID and update their integrations and preferences
    // { new: true } returns the updated document
    // { runValidators: true } ensures Mongoose schema validators are run on the update
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.firebaseUser.uid },
      { $set: { integrations, preferences } },
      { new: true, runValidators: true }
    ).select('preferences integrations'); // Select only relevant fields to return in the response

    if (!user) {
      return res.status(404).json({ message: 'User not found for updating settings.' });
    }
    res.status(200).json({ message: 'Settings updated successfully', user });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(400).json({ message: 'Error updating user settings.', error: error.message });
  }
});

module.exports = router;
