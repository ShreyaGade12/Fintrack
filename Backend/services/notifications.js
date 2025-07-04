// services/notifications.js
// This file would handle sending various notifications to users.

const User = require('../models/User'); // Assuming User.js model
const io = require('../server').get('io'); // Import the Socket.IO instance from server.js

const NotificationService = {
  async sendWeeklyReports() {
    console.log('NotificationService: Sending weekly reports...');
    const usersToNotify = await User.findAll({ where: { 'preferences.notifications.weeklyReport': true } });
    for (const user of usersToNotify) {
      console.log(`NotificationService: Sending weekly report to ${user.email}`);
      // Placeholder for email/push notification sending logic
      // Example:
      // SendGrid.sendEmail({ to: user.email, subject: 'Your Weekly FinTrack Report' });
    }
    console.log('NotificationService: Weekly reports sent.');
  },

  async sendMonthlyReports() {
    console.log('NotificationService: Sending monthly reports...');
    const usersToNotify = await User.findAll({ where: { 'preferences.notifications.monthlyReport': true } });
    for (const user of usersToNotify) {
      console.log(`NotificationService: Sending monthly report to ${user.email}`);
      // Placeholder for email/push notification sending logic
    }
    console.log('NotificationService: Monthly reports sent.');
  },

  async sendBudgetAlert(userId, message) {
    console.log(`NotificationService: Sending budget alert to user ${userId}: ${message}`);
    // Logic to send real-time budget alerts (e.g., via Socket.IO or push notifications)
    if (io) {
      io.to(userId).emit('budgetAlert', { message });
    }
  },

  async sendEmotionalSpendingAlert(userId, message) {
    console.log(`NotificationService: Sending emotional spending alert to user ${userId}: ${message}`);
    // Logic to send real-time emotional spending alerts
    if (io) {
      io.to(userId).emit('emotionalSpendingAlert', { message });
    }
  },

  // New: Send Anomaly Alert
  async sendAnomalyAlert(userId, alertData) {
    console.log(`NotificationService: Sending anomaly alert to user ${userId}:`, alertData.message);
    if (io) {
      io.to(userId).emit('anomalyAlert', alertData); // Emit to the specific user's room
    }
  }
};

module.exports = NotificationService;
