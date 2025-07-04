// routes/analytics.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware
const Expense = require('../models/Expense'); // Import Expense model
// const AnalyticsEvent = require('../models/AnalyticsEvent'); // Future: If you create a dedicated model for analytics events

// Protect all analytics routes
router.use(verifyFirebaseToken);

// Placeholder for general analytics data
router.get('/', (req, res) => {
  res.status(200).json({ message: 'Analytics data will be here!', userId: req.firebaseUser.uid });
});

// GET emotional spending data for the authenticated user
// This endpoint aggregates expenses by mood tag.
router.get('/emotional-spend/:userId', async (req, res) => {
  try {
    // Ensure the requested userId from params matches the authenticated Firebase UID
    if (req.params.userId !== req.firebaseUser.uid) {
      return res.status(403).json({ message: 'Unauthorized access to emotional spend data.' });
    }

    const emotionalSpend = await Expense.aggregate([
      // Match expenses belonging to the authenticated user, that have a mood tag, and are not deleted
      { $match: { user: req.firebaseUser.uid, 'mood.tag': { $exists: true, $ne: null }, isDeleted: false } },
      // Group by mood tag, calculate total amount spent and count of expenses for each mood
      { $group: {
          _id: '$mood.tag', // Group by the mood tag
          totalAmount: { $sum: '$amount' }, // Sum the amount for each mood
          expenseCount: { $sum: 1 } // Count the number of expenses for each mood
      }},
      // Project the results to rename _id to mood and include other fields
      { $project: {
          _id: 0, // Exclude the default _id field
          mood: '$_id', // Rename _id to mood
          totalAmount: 1, // Include totalAmount
          expenseCount: 1 // Include expenseCount
      }},
      // Sort by totalAmount in descending order (optional)
      { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json(emotionalSpend);
  } catch (error) {
    console.error('Error fetching emotional spend data:', error);
    res.status(500).json({ message: 'Server error fetching emotional spend data.', error: error.message });
  }
});

// GET top vendors for the authenticated user
// This endpoint aggregates expenses by vendor name and returns the top N.
router.get('/top-vendors/:userId', async (req, res) => {
  try {
    // Ensure the requested userId from params matches the authenticated Firebase UID
    if (req.params.userId !== req.firebaseUser.uid) {
      return res.status(403).json({ message: 'Unauthorized access to top vendors data.' });
    }

    const topVendors = await Expense.aggregate([
      // Match expenses belonging to the authenticated user, that have a vendor name, and are not deleted
      { $match: { user: req.firebaseUser.uid, 'vendor.name': { $exists: true, $ne: null, $ne: '' }, isDeleted: false } },
      // Group by vendor name and sum the amounts
      { $group: {
          _id: '$vendor.name', // Group by vendor name
          totalAmount: { $sum: '$amount' }, // Sum the amount for each vendor
          expenseCount: { $sum: 1 } // Count expenses per vendor
      }},
      // Sort by total amount in descending order
      { $sort: { totalAmount: -1 } },
      // Limit to top 5 vendors
      { $limit: 5 },
      // Project the results to rename _id to name and include other fields
      { $project: {
          _id: 0,
          name: '$_id', // Rename _id to name
          totalAmount: 1,
          expenseCount: 1
      }}
    ]);

    res.status(200).json(topVendors);
  } catch (error) {
    console.error('Error fetching top vendors:', error);
    res.status(500).json({ message: 'Server error fetching top vendors.', error: error.message });
  }
});

// NEW: Endpoint to track analytics events (including A/B test events)
router.post('/track-event', async (req, res) => {
  const { eventName, eventProperties, userId } = req.body;

  // Basic validation
  if (!eventName || !userId) {
    return res.status(400).json({ message: 'Event name and user ID are required.' });
  }

  // Ensure the userId from the request body matches the authenticated Firebase UID
  if (req.firebaseUser.uid !== userId) {
    return res.status(403).json({ message: 'Unauthorized: User ID mismatch for event tracking.' });
  }

  try {
    console.log(`Analytics Event Received:
      User ID: ${userId}
      Event Name: ${eventName}
      Properties: ${JSON.stringify(eventProperties)}`);

    // --- FUTURE IMPROVEMENT ---
    // In a production system, you would:
    // 1. Store this event data in a dedicated analytics database (e.g., PostgreSQL table for analytics events, or a data warehouse).
    //    You could define a Sequelize model for AnalyticsEvent.
    //    Example: await AnalyticsEvent.create({ userId, eventName, properties: eventProperties });
    // 2. Potentially send this data to an external analytics service (e.g., Google Analytics, Mixpanel, Amplitude).
    // 3. For A/B testing, you would later run queries on this stored data to compare conversion rates
    //    between 'control' and 'variantA' for the 'expense_added_conversion' event.
    // --- END FUTURE IMPROVEMENT ---

    res.status(200).json({ message: 'Event tracked successfully.' });
  } catch (error) {
    console.error('Error tracking analytics event:', error);
    res.status(500).json({ message: 'Server error tracking event.', error: error.message });
  }
});


module.exports = router;
