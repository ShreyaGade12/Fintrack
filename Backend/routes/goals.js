// models/Goal.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');
const User = require('./User'); // Import User model for association

const Goal = sequelize.define('Goal', {
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
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Goal title is required' },
      len: { args: [1, 100], msg: 'Goal title cannot exceed 100 characters' }
    }
  },
  description: {
    type: DataTypes.STRING(500)
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['savings', 'expense_reduction', 'debt_payoff', 'investment', 'emergency_fund', 'vacation', 'purchase', 'other']]
    }
  },
  targetAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: 'Target amount cannot be negative' }
    },
    field: 'target_amount'
  },
  currentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    validate: {
      min: { args: 0, msg: 'Current amount cannot be negative' }
    },
    field: 'current_amount'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR',
    validate: {
      isIn: [['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']]
    }
  },
  timeline: {
    type: DataTypes.JSONB,
    defaultValue: { startDate: DataTypes.NOW, targetDate: null, completedDate: null }
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: 'medium',
    validate: {
      isIn: [['low', 'medium', 'high', 'critical']]
    }
  },
  category: {
    type: DataTypes.STRING(50),
    validate: {
      isIn: [['food', 'transport', 'shopping', 'entertainment', 'healthcare',
              'utilities', 'education', 'travel', 'fitness', 'groceries',
              'dining', 'fuel', 'insurance', 'investment', 'charity',
              'personal_care', 'home', 'electronics', 'clothing', 'books',
              'subscriptions', 'gifts', 'taxi', 'other']]
    }
  },
  recurringContribution: {
    type: DataTypes.JSONB,
    defaultValue: { enabled: false, amount: 0, frequency: null, nextContributionDate: null, autoDeduct: false },
    field: 'recurring_contribution'
  },
  milestones: {
    type: DataTypes.JSONB, // Array of objects
    defaultValue: []
  },
  strategies: {
    type: DataTypes.JSONB,
    defaultValue: {
      budgetAllocation: { percentage: null, categories: [] },
      automatedSavings: { enabled: false, rules: [] },
      incentives: { enabled: false, rewards: [] }
    }
  },
  tracking: {
    type: DataTypes.JSONB,
    defaultValue: {
      contributions: [], // Array of objects
      progress: [],      // Array of objects
      analytics: { averageMonthlyContribution: null, projectedCompletionDate: null, velocityTrend: null, lastCalculated: null }
    }
  },
  aiOptimization: {
    type: DataTypes.JSONB,
    defaultValue: {
      enabled: true,
      suggestions: [], // Array of objects
      riskAssessment: { level: null, factors: [], lastAssessed: null },
      predictiveInsights: { likelihoodOfSuccess: null, suggestedAdjustments: [], alternativeStrategies: [] }
    },
    field: 'ai_optimization'
  },
  notifications: {
    type: DataTypes.JSONB,
    defaultValue: { milestoneAlerts: true, progressReminders: true, frequency: 'weekly', customAlerts: [] }
  },
  sharing: {
    type: DataTypes.JSONB,
    defaultValue: { isPublic: false, sharedWith: [], supportGroup: { enabled: false, groupId: null, role: null } }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'paused', 'completed', 'cancelled', 'overdue']]
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  notes: {
    type: DataTypes.STRING(1000)
  },
  attachments: {
    type: DataTypes.JSONB, // Array of objects
    defaultValue: []
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_archived'
  }
}, {
  tableName: 'goals',
  timestamps: true,
  hooks: {
    beforeUpdate: (goal) => {
      // Update status based on progress and dates
      if (parseFloat(goal.currentAmount) >= parseFloat(goal.targetAmount) && goal.status !== 'completed') {
        goal.status = 'completed';
        goal.timeline.completedDate = new Date();
      } else if (new Date() > new Date(goal.timeline.targetDate) && goal.status === 'active') {
        goal.status = 'overdue';
      }

      // Update milestones (assuming milestones are in JSONB and need manual iteration)
      if (goal.milestones && Array.isArray(goal.milestones)) {
        goal.milestones.forEach(milestone => {
          if (!milestone.achieved && parseFloat(goal.currentAmount) >= milestone.amount) {
            milestone.achieved = true;
            milestone.achievedDate = new Date().toISOString();
          }
        });
      }
    }
  }
});

// Define association
User.hasMany(Goal, { foreignKey: 'user_id', as: 'goals' });
Goal.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Virtual for progress percentage
Object.defineProperty(Goal.prototype, 'progressPercentage', {
  get() {
    if (parseFloat(this.targetAmount) === 0) return 0;
    return Math.min(100, Math.round((parseFloat(this.currentAmount) / parseFloat(this.targetAmount)) * 100));
  }
});

// Virtual for remaining amount
Object.defineProperty(Goal.prototype, 'remainingAmount', {
  get() {
    return Math.max(0, parseFloat(this.targetAmount) - parseFloat(this.currentAmount));
  }
});

// Virtual for days remaining
Object.defineProperty(Goal.prototype, 'daysRemaining', {
  get() {
    const now = new Date();
    const targetDate = new Date(this.timeline.targetDate);
    const diffTime = targetDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
});

// Virtual for required daily savings
Object.defineProperty(Goal.prototype, 'requiredDailySavings', {
  get() {
    const daysRemaining = this.daysRemaining;
    if (daysRemaining <= 0) return 0;
    return Math.round(this.remainingAmount / daysRemaining);
  }
});

// Virtual for current velocity (simplified for Sequelize JSONB array)
Object.defineProperty(Goal.prototype, 'currentVelocity', {
  get() {
    if (!this.tracking || !this.tracking.contributions || this.tracking.contributions.length < 2) return 0;

    const sortedContributions = [...this.tracking.contributions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sortedContributions.slice(0, 5); // Consider last 5 contributions

    const totalAmount = recent.reduce((sum, contrib) => sum + contrib.amount, 0);
    const timeSpan = new Date(recent[0].date) - new Date(recent[recent.length - 1].date);
    const days = timeSpan / (1000 * 60 * 60 * 24);

    return days > 0 ? totalAmount / days : 0;
  }
});


// Instance method to add contribution
Goal.prototype.addContribution = async function(amount, source = 'manual', description = '', transactionId = null) {
  this.currentAmount = parseFloat(this.currentAmount) + amount;

  const newContribution = {
    amount: amount,
    date: new Date().toISOString(),
    source: source,
    description: description,
    transactionId: transactionId
  };
  this.tracking.contributions = [...(this.tracking.contributions || []), newContribution];

  const newProgress = {
    date: new Date().toISOString(),
    amount: parseFloat(this.currentAmount),
    percentage: this.progressPercentage,
    note: `Added ${amount} via ${source}`
  };
  this.tracking.progress = [...(this.tracking.progress || []), newProgress];

  this.updateAnalytics(); // Update analytics after contribution
  return this.save();
};

// Instance method to update analytics
Goal.prototype.updateAnalytics = function() {
  const contributions = this.tracking.contributions || [];
  if (contributions.length === 0) return;

  // Calculate average monthly contribution
  const monthlyContribs = {};
  contributions.forEach(contrib => {
    const monthKey = new Date(contrib.date).toISOString().substring(0, 7);
    monthlyContribs[monthKey] = (monthlyContribs[monthKey] || 0) + contrib.amount;
  });

  const months = Object.keys(monthlyContribs);
  this.tracking.analytics.averageMonthlyContribution = months.length > 0
    ? Object.values(monthlyContribs).reduce((a, b) => a + b, 0) / months.length
    : 0;

  // Project completion date
  const remainingAmount = this.remainingAmount;
  const avgMonthly = this.tracking.analytics.averageMonthlyContribution;

  if (avgMonthly > 0 && remainingAmount > 0) {
    const monthsToComplete = remainingAmount / avgMonthly;
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + monthsToComplete);
    this.tracking.analytics.projectedCompletionDate = projectedDate.toISOString();
  } else {
    this.tracking.analytics.projectedCompletionDate = null;
  }

  // Determine velocity trend
  if (contributions.length >= 3) {
    const recent = contributions.slice(-3);
    const older = contributions.slice(-6, -3);

    const recentAvg = recent.reduce((sum, c) => sum + c.amount, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, c) => sum + c.amount, 0) / older.length : 0;

    if (recentAvg > olderAvg * 1.1) {
      this.tracking.analytics.velocityTrend = 'accelerating';
    } else if (recentAvg < olderAvg * 0.9) {
      this.tracking.analytics.velocityTrend = 'slowing';
    } else {
      this.tracking.analytics.velocityTrend = 'stable';
    }
  } else {
    this.tracking.analytics.velocityTrend = null;
  }

  this.tracking.analytics.lastCalculated = new Date().toISOString();
};


// Instance method to generate AI suggestions
Goal.prototype.generateAISuggestions = function() {
  const suggestions = [];

  // Suggestion based on progress
  if (this.progressPercentage < 25 && this.daysRemaining < 30) {
    suggestions.push({
      type: 'urgency',
      message: 'Your goal is behind schedule. Consider increasing your contribution frequency.',
      impact: 0.8,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
      implemented: false
    });
  }

  // Suggestion based on velocity
  if (this.tracking.analytics.velocityTrend === 'slowing') {
    suggestions.push({
      type: 'motivation',
      message: 'Your savings velocity is decreasing. Try setting up automated contributions.',
      impact: 0.6,
      confidence: 0.7,
      createdAt: new Date().toISOString(),
      implemented: false
    });
  }

  // Suggestion for milestone rewards
  const nextMilestone = (this.milestones || []).find(m => !m.achieved);
  if (nextMilestone && parseFloat(this.currentAmount) >= nextMilestone.amount * 0.9) {
    suggestions.push({
      type: 'milestone',
      message: `You're almost at your ${nextMilestone.percentage}% milestone! Just ${nextMilestone.amount - parseFloat(this.currentAmount)} more to go.`,
      impact: 0.5,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
      implemented: false
    });
  }

  this.aiOptimization.suggestions = suggestions;
  return suggestions;
};

// Instance method to pause/resume goal
Goal.prototype.togglePause = async function() {
  if (this.status === 'active') {
    this.status = 'paused';
  } else if (this.status === 'paused') {
    this.status = 'active';
  }
  return this.save();
};

// Instance method to cancel goal
Goal.prototype.cancel = async function(reason = '') {
  this.status = 'cancelled';
  this.notes = this.notes ? `${this.notes}\n\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  return this.save();
};

// Instance method to archive goal
Goal.prototype.archive = async function() {
  this.isArchived = true;
  return this.save();
};

// Instance method to calculate risk assessment
Goal.prototype.calculateRiskAssessment = function() {
  const factors = [];
  let riskLevel = 'low';

  // Check if goal is overdue
  if (this.status === 'overdue') {
    factors.push('Goal is overdue');
    riskLevel = 'high';
  }

  // Check progress vs time elapsed
  const totalDays = Math.ceil((new Date(this.timeline.targetDate) - new Date(this.timeline.startDate)) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((new Date() - new Date(this.timeline.startDate)) / (1000 * 60 * 60 * 24));
  const timeProgress = totalDays > 0 ? elapsedDays / totalDays : 0;
  const amountProgress = this.progressPercentage / 100;

  if (timeProgress > amountProgress + 0.2) {
    factors.push('Progress is significantly behind schedule');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  // Check velocity trend
  if (this.tracking.analytics.velocityTrend === 'slowing') {
    factors.push('Contribution velocity is decreasing');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  // Check if target amount is realistic
  if (this.requiredDailySavings > (this.tracking.analytics.averageMonthlyContribution || 0) / 30 * 2) {
    factors.push('Required daily savings may be unrealistic');
    riskLevel = 'medium';
  }

  this.aiOptimization.riskAssessment = {
    level: riskLevel,
    factors: factors,
    lastAssessed: new Date().toISOString()
  };

  return this.aiOptimization.riskAssessment;
};

module.exports = Goal;
