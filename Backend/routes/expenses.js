// routes/expenses.js
const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense'); // Assuming Expense.js is in Backend/models/Expense.js
const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware

// Protect all expense routes
router.use(verifyFirebaseToken);

// Get all expenses for the authenticated user
router.get('/', async (req, res) => {
  try {
    // Use req.firebaseUser.uid to find expenses for the current user
    const expenses = await Expense.find({ user: req.firebaseUser.uid, isDeleted: false }).sort({ date: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Server error fetching expenses.', error: error.message });
  }
});

// Get recent expenses for the authenticated user (for dashboard)
router.get('/recent', async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.firebaseUser.uid, isDeleted: false })
                                .sort({ date: -1 })
                                .limit(5); // Limit to 5 recent expenses
    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching recent expenses:', error);
    res.status(500).json({ message: 'Server error fetching recent expenses.', error: error.message });
  }
});

// Get recurring expenses for the authenticated user
router.get('/recurring', async (req, res) => {
  try {
    // Use the static method from the Expense model to get recurring expenses
    const recurringExpenses = await Expense.getRecurring(req.firebaseUser.uid);
    res.status(200).json(recurringExpenses);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    res.status(500).json({ message: 'Server error fetching recurring expenses.', error: error.message });
  }
});


// Add a new expense for the authenticated user
router.post('/', async (req, res) => {
  const { amount, currency, description, category, subcategory, vendor, paymentMethod, transactionId, date, tags, notes, isRecurring, recurringDetails, splitDetails, source, mood, emotionalContext, aiAnalysis, receipts, location, budgetCategory } = req.body;

  try {
    const newExpense = new Expense({
      user: req.firebaseUser.uid, // Associate with Firebase UID
      amount, currency, description, category, subcategory, vendor, paymentMethod, transactionId, date, tags, notes, isRecurring, recurringDetails, splitDetails, source, mood, emotionalContext, aiAnalysis, receipts, location, budgetCategory
    });
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(400).json({ message: 'Error adding expense.', error: error.message });
  }
});

 

module.exports = router;
