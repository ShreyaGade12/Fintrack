    // routes/budget.js
    const express = require('express');
    const router = express.Router();
    const Budget = require('../models/Budget'); // Assuming Budget.js is in Backend/models/Budget.js
    const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware

    // Protect all budget routes
    router.use(verifyFirebaseToken);

    // Get all budgets for the authenticated user
    router.get('/', async (req, res) => {
      try {
        const budgets = await Budget.find({ user: req.firebaseUser.uid, isArchived: false });
        res.status(200).json(budgets);
      } catch (error) {
        console.error('Error fetching budgets:', error);
        res.status(500).json({ message: 'Server error fetching budgets.', error: error.message });
      }
    });

    // Get active budgets for the authenticated user (for dashboard)
    router.get('/active', async (req, res) => {
      try {
        const budgets = await Budget.find({ user: req.firebaseUser.uid, isActive: true, isArchived: false });
        res.status(200).json(budgets);
      } catch (error) {
        console.error('Error fetching active budgets:', error);
        res.status(500).json({ message: 'Server error fetching active budgets.', error: error.message });
      }
    });

    // Add a new budget for the authenticated user
    router.post('/', async (req, res) => {
      const { name, category, amount, period } = req.body;

      try {
        const newBudget = new Budget({
          user: req.firebaseUser.uid, // Associate with Firebase UID
          name, category, amount, period
        });
        await newBudget.save();
        res.status(201).json(newBudget);
      } catch (error) {
        console.error('Error adding budget:', error);
        res.status(400).json({ message: 'Error adding budget.', error: error.message });
      }
    });

    // You would add PUT, DELETE, and other specific GET routes here as needed.

    module.exports = router;
    