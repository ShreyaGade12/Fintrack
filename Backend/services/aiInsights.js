// services/aiInsights.js
// This file contains the core AI logic for generating insights,
// recommendations, and now, anomaly detection.

const User = require('../models/User');
const Expense = require('../models/Expense'); // Ensure Expense model is imported
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const { Op } = require('sequelize'); // Import Op for Sequelize operators

// Load GEMINI_API_KEY from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = ` `;

const AIInsightsEngine = {
  async generateDailyInsights() {
    console.log('AIInsightsEngine: Generating daily insights for all users...');
    const activeUsers = await User.findActiveUsers();
    for (const user of activeUsers) {
      console.log(`AIInsightsEngine: Generating daily insights for ${user.email}`);
      // ... (existing daily insights logic) ...
    }
    console.log('AIInsightsEngine: Daily insights generation completed.');
  },

  async generateWeeklyInsights() {
    console.log('AIInsightsEngine: Generating weekly insights for all users...');
    const activeUsers = await User.findActiveUsers();
    for (const user of activeUsers) {
      console.log(`AIInsightsEngine: Generating weekly insights for ${user.email}`);
      // ... (existing weekly insights logic) ...
    }
    console.log('AIInsightsEngine: Weekly insights generation completed.');
  },

  async generateMonthlyInsights() {
    console.log('AIInsightsEngine: Generating monthly insights for all users...');
    const activeUsers = await User.findActiveUsers();
    for (const user of activeUsers) {
      console.log(`AIInsightsEngine: Generating monthly insights for ${user.email}`);
      // ... (existing monthly insights logic) ...
    }
    console.log('AIInsightsEngine: Monthly insights generation completed.');
  },

  // New: Real-time Anomaly Detection
  async detectAnomaly(newExpense) {
    const userId = newExpense.userId;
    const category = newExpense.category;
    const amount = parseFloat(newExpense.amount);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2); // Look at last 2 months of data

    console.log(`Detecting anomaly for user ${userId}, category ${category}, amount ${amount}`);

    try {
      // Fetch historical expenses for the same user and category
      const historicalExpenses = await Expense.findAll({
        where: {
          userId: userId,
          category: category,
          date: { [Op.gte]: twoMonthsAgo }, // Expenses within the last 2 months
          isDeleted: false
        },
        attributes: ['amount'] // Only fetch the amount
      });

      const historicalAmounts = historicalExpenses.map(e => parseFloat(e.amount));

      if (historicalAmounts.length < 5) { // Need a minimum number of data points to calculate meaningful stats
        console.log('Not enough historical data for anomaly detection in this category.');
        return { isAnomaly: false, score: 0, reason: 'Insufficient historical data' };
      }

      // Calculate mean and standard deviation (online learning concept simplified)
      // In a more advanced system, these stats would be persisted and updated incrementally
      const mean = historicalAmounts.reduce((sum, val) => sum + val, 0) / historicalAmounts.length;
      const squaredDifferences = historicalAmounts.map(val => Math.pow(val - mean, 2));
      const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / historicalAmounts.length;
      const stdDev = Math.sqrt(variance);

      // Calculate Z-score for the new expense
      let zScore = 0;
      if (stdDev > 0) { // Avoid division by zero
        zScore = Math.abs(amount - mean) / stdDev;
      }

      // Define anomaly thresholds (these can be tuned)
      const Z_SCORE_THRESHOLD = 2.5; // e.g., 2.5 standard deviations from the mean
      const ABSOLUTE_AMOUNT_THRESHOLD = 5000; // e.g., any single expense over 5000 is suspicious
      const CATEGORY_SPIKE_THRESHOLD = 1.5; // e.g., new expense is 1.5x larger than max historical for category

      let isAnomaly = false;
      let reason = '';

      // Rule 1: Z-score based anomaly
      if (zScore > Z_SCORE_THRESHOLD) {
        isAnomaly = true;
        reason += `Amount (${amount}) is significantly higher than average (${mean.toFixed(2)}) for ${category}. (Z-score: ${zScore.toFixed(2)})`;
      }

      // Rule 2: Absolute high amount
      if (amount > ABSOLUTE_AMOUNT_THRESHOLD && amount > mean * 2) { // Must be high and also significantly higher than mean
        if (isAnomaly) reason += ' And ';
        isAnomaly = true;
        reason += `Very high amount (${amount}) for a single transaction.`;
      }

      // Rule 3: Spike compared to recent max (simple spike detection)
      const maxHistoricalAmount = Math.max(...historicalAmounts);
      if (amount > maxHistoricalAmount * CATEGORY_SPIKE_THRESHOLD) {
        if (isAnomaly) reason += ' And ';
        isAnomaly = true;
        reason += `Amount (${amount}) is a significant spike compared to previous high (${maxHistoricalAmount.toFixed(2)}) for ${category}.`;
      }

      if (isAnomaly) {
        console.warn(`Anomaly Detected: User ${userId}, Category: ${category}, Amount: ${amount}, Reason: ${reason}`);
        return { isAnomaly: true, score: zScore, reason: reason };
      } else {
        console.log('No anomaly detected for this expense.');
        return { isAnomaly: false, score: zScore, reason: 'No anomaly detected' };
      }

    } catch (error) {
      console.error('Error during anomaly detection:', error);
      return { isAnomaly: false, score: 0, reason: `Error in detection: ${error.message}` };
    }
  },

  // Existing: AI Coach Response
  async getAICoachResponse(userId, userMessage) {
    console.log(`AI Coach: Processing message for user ${userId}: "${userMessage}"`);

    // Fetch relevant user data to provide context to the AI
    const user = await User.findOne({ where: { firebaseUid: userId } });
    const recentExpenses = await Expense.findAll({ where: { userId: userId, isDeleted: false }, order: [['date', 'DESC']], limit: 5 });
    const activeBudgets = await Budget.findAll({ where: { userId: userId, isActive: true, isArchived: false }, limit: 3 });
    const activeGoals = await Goal.findAll({ where: { userId: userId, status: 'active', isArchived: false }, limit: 3 });

    // Construct a detailed prompt for the LLM
    let prompt = `You are FinTrack, an AI financial coach. Your goal is to provide helpful, actionable, and empathetic financial advice.
    The user's ID is ${userId}. Their email is ${user ? user.email : 'N/A'}.
    Here is some of their recent financial data:
    - Recent Expenses: ${recentExpenses.length > 0 ? JSON.stringify(recentExpenses.map(e => ({ desc: e.description, amount: parseFloat(e.amount), category: e.category, date: e.date }))) : 'No recent expenses.'}
    - Active Budgets: ${activeBudgets.length > 0 ? JSON.stringify(activeBudgets.map(b => ({ name: b.name, category: b.category, amount: parseFloat(b.amount), spent: parseFloat(b.spent), period: b.period.type }))) : 'No active budgets.'}
    - Active Goals: ${activeGoals.length > 0 ? JSON.stringify(activeGoals.map(g => ({ title: g.title, target: parseFloat(g.targetAmount), current: parseFloat(g.currentAmount), type: g.type }))) : 'No active goals.'}

    The user's query is: "${userMessage}".

    Based on the provided information and the user's query, please give a concise, actionable financial tip or answer. If the query is too general or not financial, ask for more specific details or guide them towards financial topics. Keep your response under 200 words.`;

    try {
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
      }

      const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
      } else {
        console.error("Gemini API returned an unexpected structure:", result);
        return "I'm sorry, I couldn't generate a detailed response at this time. The AI might be having trouble understanding or generating content.";
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return `I'm currently unable to connect to the AI service. Please ensure your GEMINI_API_KEY is correct and try again later. Error: ${error.message}`;
    }
  }
};

module.exports = AIInsightsEngine;
