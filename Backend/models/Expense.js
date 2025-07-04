// models/Expense.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db'); // Import the sequelize instance
const User = require('./User'); // Import User model for association

const Expense = sequelize.define('Expense', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  userId: { // Foreign key for User
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: User, // This is a reference to the User model
      key: 'id', // This is the column name of the referenced model
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: { args: [0.01], msg: 'Amount must be greater than 0' }
    }
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR',
    validate: {
      isIn: [['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']]
    }
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Description is required' },
      len: { args: [1, 500], msg: 'Description cannot exceed 500 characters' }
    }
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['food', 'transport', 'shopping', 'entertainment', 'healthcare',
              'utilities', 'education', 'travel', 'fitness', 'groceries',
              'dining', 'fuel', 'insurance', 'investment', 'charity',
              'personal_care', 'home', 'electronics', 'clothing', 'books',
              'subscriptions', 'gifts', 'taxi', 'other']]
    }
  },
  subcategory: {
    type: DataTypes.STRING(100)
  },
  vendor: {
    type: DataTypes.JSONB, // Store vendor details as JSONB
    defaultValue: { name: null, type: 'other', location: {} }
  },
  paymentMethod: {
    type: DataTypes.JSONB, // Store payment method details as JSONB
    defaultValue: { type: 'cash', details: {} },
    field: 'payment_method'
  },
  transactionId: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true, // Can be null
    field: 'transaction_id'
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING), // Array of strings
    defaultValue: []
  },
  notes: {
    type: DataTypes.STRING(1000)
  },
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_recurring'
  },
  recurringDetails: {
    type: DataTypes.JSONB,
    defaultValue: { frequency: null, interval: null, endDate: null, nextDate: null, isActive: true },
    field: 'recurring_details'
  },
  splitDetails: {
    type: DataTypes.JSONB,
    defaultValue: { isSplit: false, totalAmount: null, userShare: null, splitWith: [] },
    field: 'split_details'
  },
  source: {
    type: DataTypes.JSONB,
    defaultValue: { type: 'manual', rawData: {}, processed: false, verified: false }
  },
  mood: {
    type: DataTypes.JSONB,
    defaultValue: { tag: null, confidence: null, detectedAt: null, isManual: false }
  },
  emotionalContext: {
    type: DataTypes.JSONB,
    defaultValue: { timeOfDay: null, dayOfWeek: null, isWeekend: false, isHoliday: false, weatherCondition: null, isImpulsive: false, impulsiveScore: null },
    field: 'emotional_context'
  },
  aiAnalysis: {
    type: DataTypes.JSONB,
    defaultValue: { categoryConfidence: null, anomalyScore: null, budgetImpact: null, recommendations: [], patterns: [], processedAt: null },
    field: 'ai_analysis'
  },
  receipts: {
    type: DataTypes.JSONB, // Array of objects
    defaultValue: []
  },
  location: {
    type: DataTypes.JSONB,
    defaultValue: { coordinates: [], address: null, city: null, state: null, country: null }
  },
  budgetCategory: { // This would be a foreign key to a Budget table if we associate expenses directly with specific budgets
    type: DataTypes.UUID,
    allowNull: true, // Can be null if not linked to a specific budget instance
    field: 'budget_category_id',
    // references: { // Uncomment and define if you create a Budget model and want a direct FK
    //   model: 'Budgets', // Table name
    //   key: 'id',
    // }
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_deleted'
  },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at'
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  }
}, {
  tableName: 'expenses',
  timestamps: true,
  hooks: {
    beforeCreate: (expense) => {
      // Set emotional context based on date
      if (expense.date) {
        const date = new Date(expense.date);
        const hour = date.getHours();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        expense.emotionalContext = expense.emotionalContext || {};
        if (hour >= 5 && hour < 12) expense.emotionalContext.timeOfDay = 'morning';
        else if (hour >= 12 && hour < 17) expense.emotionalContext.timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 21) expense.emotionalContext.timeOfDay = 'evening';
        else if (hour >= 21 || hour < 2) expense.emotionalContext.timeOfDay = 'night';
        else expense.emotionalContext.timeOfDay = 'late_night';

        expense.emotionalContext.dayOfWeek = days[date.getDay()];
        expense.emotionalContext.isWeekend = date.getDay() === 0 || date.getDay() === 6;

        // Detect potential impulsive spending
        if ((hour >= 22 || hour <= 2) && expense.amount > 1000) { // Example threshold
          expense.emotionalContext.isImpulsive = true;
          expense.emotionalContext.impulsiveScore = Math.min(0.8, (hour >= 23 ? 0.7 : 0.5) + (expense.amount / 10000));
        }
      }
    },
    beforeUpdate: (expense) => {
      if (expense.changed('isDeleted') && expense.isDeleted) {
        expense.deletedAt = new Date();
      }
      // Re-evaluate emotional context if date changes
      if (expense.changed('date')) {
        const date = new Date(expense.date);
        const hour = date.getHours();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        expense.emotionalContext = expense.emotionalContext || {};
        if (hour >= 5 && hour < 12) expense.emotionalContext.timeOfDay = 'morning';
        else if (hour >= 12 && hour < 17) expense.emotionalContext.timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 21) expense.emotionalContext.timeOfDay = 'evening';
        else if (hour >= 21 || hour < 2) expense.emotionalContext.timeOfDay = 'night';
        else expense.emotionalContext.timeOfDay = 'late_night';

        expense.emotionalContext.dayOfWeek = days[date.getDay()];
        expense.emotionalContext.isWeekend = date.getDay() === 0 || date.getDay() === 6;

        if ((hour >= 22 || hour <= 2) && expense.amount > 1000) {
          expense.emotionalContext.isImpulsive = true;
          expense.emotionalContext.impulsiveScore = Math.min(0.8, (hour >= 23 ? 0.7 : 0.5) + (expense.amount / 10000));
        } else {
          expense.emotionalContext.isImpulsive = false;
          expense.emotionalContext.impulsiveScore = null;
        }
      }
    }
  }
});
AIInsightsEngine.detectAnomaly(newExpense)
      .then(anomalyResult => {
        if (anomalyResult.isAnomaly) {
          console.log('Anomaly detected, sending alert:', anomalyResult.reason);
          // Update the expense with anomaly details
          newExpense.update({
            aiAnalysis: {
              ...newExpense.aiAnalysis,
              anomalyScore: anomalyResult.score,
              recommendations: [...(newExpense.aiAnalysis.recommendations || []), `Anomaly detected: ${anomalyResult.reason}`],
              processedAt: new Date()
            }
          });
          // Send real-time notification to the frontend
          NotificationService.sendAnomalyAlert(req.firebaseUser.uid, {
            message: `Potential anomaly detected in your recent spending: ${newExpense.description} (${newExpense.amount} ${newExpense.currency}). Reason: ${anomalyResult.reason}`,
            expenseId: newExpense.id,
            category: newExpense.category,
            amount: newExpense.amount
          });
        }
      })
      .catch(anomalyError => {
        console.error('Error during anomaly detection process:', anomalyError);
      });
// Define association
User.hasMany(Expense, { foreignKey: 'user_id', as: 'expenses' });
Expense.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Static method to get recurring expenses
Expense.getRecurring = async function(userId) {
  return this.findAll({
    where: {
      userId: userId,
      isRecurring: true,
      'recurringDetails.isActive': true,
      isDeleted: false
    }
  });
};

// Instance method to mark as deleted
Expense.prototype.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Instance method to restore deleted expense
Expense.prototype.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null; // Set to null for restoration
  return this.save();
};

// Instance method to duplicate expense
Expense.prototype.duplicate = function() {
  const duplicated = Expense.build({
    userId: this.userId,
    amount: this.amount,
    currency: this.currency,
    description: `${this.description} (Copy)`,
    category: this.category,
    subcategory: this.subcategory,
    vendor: this.vendor,
    paymentMethod: this.paymentMethod,
    transactionId: null, // New transaction, so no ID
    date: new Date(), // New date
    tags: [...this.tags],
    notes: this.notes,
    isRecurring: false, // Duplicated is not recurring by default
    recurringDetails: {},
    splitDetails: {},
    source: { type: 'manual', rawData: {}, processed: false, verified: false },
    mood: this.mood,
    emotionalContext: this.emotionalContext,
    aiAnalysis: {},
    receipts: [],
    location: this.location,
    budgetCategory: this.budgetCategory,
    isDeleted: false,
    version: 1
  });
  return duplicated;
};

module.exports = Expense;
