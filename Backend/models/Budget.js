// models/Budget.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const User = require('./User'); // Import User model for association

const Budget = sequelize.define('Budget', {
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
      model: User,
      key: 'id',
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Budget name is required' },
      len: { args: [1, 100], msg: 'Budget name cannot exceed 100 characters' }
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
              'subscriptions', 'gifts', 'taxi', 'other', 'total']]
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: 'Budget amount cannot be negative' }
    }
  },
  spent: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    validate: {
      min: { args: 0, msg: 'Spent amount cannot be negative' }
    }
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR',
    validate: {
      isIn: [['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']]
    }
  },
  period: {
    type: DataTypes.JSONB,
    defaultValue: { type: 'monthly', startDate: null, endDate: null, autoReset: true }
  },
  alertThresholds: {
    type: DataTypes.JSONB,
    defaultValue: {
      warning: { percentage: 70, triggered: false, lastTriggered: null },
      critical: { percentage: 90, triggered: false, lastTriggered: null },
      exceeded: { triggered: false, lastTriggered: null }
    },
    field: 'alert_thresholds'
  },
  emotionalControls: {
    type: DataTypes.JSONB,
    defaultValue: { enabled: false, restrictedMoods: [], cooldownPeriod: 30, maxImpulsiveSpend: 500 },
    field: 'emotional_controls'
  },
  rules: {
    type: DataTypes.JSONB,
    defaultValue: { strictMode: false, allowanceOverride: 0, blockCategories: [], allowedVendors: [], timeRestrictions: { enabled: false, restrictedHours: [] } }
  },
  aiOptimization: {
    type: DataTypes.JSONB,
    defaultValue: { learningMode: 'adaptive', autoAdjustments: { enabled: false, maxAdjustmentPercentage: 10, lastAdjustment: null, adjustmentHistory: [] }, predictedSpend: { amount: null, confidence: null, calculatedAt: null } },
    field: 'ai_optimization'
  },
  performance: {
    type: DataTypes.JSONB,
    defaultValue: { currentPeriod: {}, historical: [] }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  notes: {
    type: DataTypes.STRING(500)
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_archived'
  },
  lastResetDate: {
    type: DataTypes.DATE,
    field: 'last_reset_date'
  },
  nextResetDate: {
    type: DataTypes.DATE,
    field: 'next_reset_date'
  }
}, {
  tableName: 'budgets',
  timestamps: true,
  hooks: {
    beforeCreate: (budget) => {
      // Set initial period dates if not provided
      if (!budget.period.startDate || !budget.period.endDate) {
        const { startDate, endDate } = budget.calculatePeriodDates();
        budget.period.startDate = startDate;
        budget.period.endDate = endDate;
      }
      budget.nextResetDate = budget.calculateNextResetDate();
    },
    beforeUpdate: (budget) => {
      if (budget.changed('period')) {
        budget.nextResetDate = budget.calculateNextResetDate();
      }
    }
  }
});

// Define association
User.hasMany(Budget, { foreignKey: 'user_id', as: 'budgets' });
Budget.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Virtual for remaining amount (getter)
Object.defineProperty(Budget.prototype, 'remaining', {
  get() {
    return Math.max(0, this.amount - this.spent);
  }
});

// Virtual for spent percentage (getter)
Object.defineProperty(Budget.prototype, 'spentPercentage', {
  get() {
    return this.amount > 0 ? Math.round((this.spent / this.amount) * 100) : 0;
  }
});

// Virtual for status (getter)
Object.defineProperty(Budget.prototype, 'status', {
  get() {
    const percentage = this.spentPercentage;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= this.alertThresholds.critical.percentage) return 'critical';
    if (percentage >= this.alertThresholds.warning.percentage) return 'warning';
    return 'healthy';
  }
});

// Virtual for days remaining (getter)
Object.defineProperty(Budget.prototype, 'daysRemaining', {
  get() {
    const now = new Date();
    const endDate = new Date(this.period.endDate);
    const diffTime = endDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
});

// Virtual for projected spend (getter)
Object.defineProperty(Budget.prototype, 'projectedSpend', {
  get() {
    const now = new Date();
    const startDate = new Date(this.period.startDate);
    const endDate = new Date(this.period.endDate);

    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    if (elapsedDays <= 0 || this.spent <= 0) return 0; // Handle division by zero or no spend yet

    const dailyAverage = parseFloat(this.spent) / elapsedDays;
    return Math.round(dailyAverage * totalDays);
  }
});

// Instance method to calculate period dates
Budget.prototype.calculatePeriodDates = function() {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);

  switch (this.period.type) {
    case 'daily':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      startDate.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(now.getMonth() + 1, 0); // Last day of current month
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      const currentMonth = now.getMonth();
      const startMonth = Math.floor(currentMonth / 3) * 3;
      startDate.setMonth(startMonth, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(startMonth + 3, 0); // Last day of last month in quarter
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'yearly':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setMonth(11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
  }
  return { startDate, endDate };
};

// Instance method to calculate next reset date based on period
Budget.prototype.calculateNextResetDate = function() {
  const endDate = new Date(this.period.endDate);
  const nextDate = new Date(endDate);

  switch (this.period.type) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }
  return nextDate;
};

// Instance method to reset budget for new period
Budget.prototype.resetForNewPeriod = async function() {
  // Save current period to history
  this.performance.historical.push({
    period: {
      start: this.period.startDate,
      end: this.period.endDate
    },
    budgeted: parseFloat(this.amount),
    spent: parseFloat(this.spent),
    adherenceScore: this.calculateAdherenceScore(),
    savings: Math.max(0, parseFloat(this.amount) - parseFloat(this.spent)),
    notes: `Auto-reset on ${new Date().toISOString()}`
  });

  // Reset current period
  this.spent = 0;
  const { startDate, endDate } = this.calculatePeriodDates(); // Recalculate for current date
  this.period.startDate = startDate;
  this.period.endDate = endDate;
  this.lastResetDate = new Date();
  this.nextResetDate = this.calculateNextResetDate();

  // Reset alert triggers
  this.alertThresholds.warning.triggered = false;
  this.alertThresholds.critical.triggered = false;
  this.alertThresholds.exceeded.triggered = false;

  return this.save();
};

// Instance method to add expense to budget
Budget.prototype.addExpense = async function(amount) {
  this.spent = parseFloat(this.spent) + amount;
  this.updatePerformanceMetrics();
  return this.save();
};

// Instance method to update performance metrics
Budget.prototype.updatePerformanceMetrics = function() {
  const now = new Date();
  const startDate = new Date(this.period.startDate);
  const endDate = new Date(this.period.endDate);

  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  this.performance.currentPeriod = {
    daysElapsed: Math.max(0, elapsedDays),
    daysRemaining: Math.max(0, remainingDays),
    averageDailySpend: elapsedDays > 0 ? parseFloat(this.spent) / elapsedDays : 0,
    projectedSpend: this.projectedSpend,
    adherenceScore: this.calculateAdherenceScore()
  };
};

// Instance method to calculate adherence score
Budget.prototype.calculateAdherenceScore = function() {
  if (parseFloat(this.amount) === 0) return 100;

  const spentPercentage = (parseFloat(this.spent) / parseFloat(this.amount)) * 100;

  if (spentPercentage <= 80) return 100;
  if (spentPercentage <= 100) return Math.max(0, 100 - (spentPercentage - 80) * 2);
  return Math.max(0, 60 - (spentPercentage - 100));
};

// Instance method to check if expense is allowed
Budget.prototype.isExpenseAllowed = function(expense) {
  // Check if budget is exceeded and strict mode is on
  if (this.rules.strictMode && parseFloat(this.spent) >= parseFloat(this.amount)) {
    return { allowed: false, reason: 'Budget exceeded and strict mode is enabled' };
  }

  // Check emotional controls
  if (this.emotionalControls.enabled && expense.mood && this.emotionalControls.restrictedMoods.includes(expense.mood.tag)) {
    return { allowed: false, reason: `Spending restricted during ${expense.mood.tag} mood` };
  }

  // Check time restrictions
  if (this.rules.timeRestrictions.enabled) {
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });

    for (const restriction of this.rules.timeRestrictions.restrictedHours) {
      if (restriction.daysOfWeek.includes(dayOfWeek)) {
        if (currentHour >= restriction.start && currentHour <= restriction.end) {
          return { allowed: false, reason: 'Spending restricted during this time' };
        }
      }
    }
  }

  return { allowed: true };
};

module.exports = Budget;
