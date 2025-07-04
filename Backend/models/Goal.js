const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
    maxlength: [100, 'Goal title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['savings', 'expense_reduction', 'debt_payoff', 'investment', 'emergency_fund', 'vacation', 'purchase', 'other'],
    required: true,
    index: true
  },
  targetAmount: {
    type: Number,
    required: [true, 'Target amount is required'],
    min: [0, 'Target amount cannot be negative']
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Current amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']
  },
  timeline: {
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    targetDate: {
      type: Date,
      required: true
    },
    completedDate: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    enum: [
      'food', 'transport', 'shopping', 'entertainment', 'healthcare', 
      'utilities', 'education', 'travel', 'fitness', 'groceries',
      'dining', 'fuel', 'insurance', 'investment', 'charity',
      'personal_care', 'home', 'electronics', 'clothing', 'books',
      'subscriptions', 'gifts', 'taxi', 'other'
    ]
  },
  recurringContribution: {
    enabled: {
      type: Boolean,
      default: false
    },
    amount: {
      type: Number,
      min: 0
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    nextContributionDate: Date,
    autoDeduct: {
      type: Boolean,
      default: false
    }
  },
  milestones: [{
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: String,
    achieved: {
      type: Boolean,
      default: false
    },
    achievedDate: Date,
    reward: String
  }],
  strategies: {
    budgetAllocation: {
      percentage: {
        type: Number,
        min: 0,
        max: 100
      },
      categories: [{
        name: String,
        reductionTarget: Number,
        currentReduction: {
          type: Number,
          default: 0
        }
      }]
    },
    automatedSavings: {
      enabled: {
        type: Boolean,
        default: false
      },
      rules: [{
        condition: String, // "spend_under_budget"
        action: String,    // "save_difference"
        amount: Number
      }]
    },
    incentives: {
      enabled: {
        type: Boolean,
        default: false
      },
      rewards: [{
        milestone: Number,
        reward: String,
        claimed: {
          type: Boolean,
          default: false
        }
      }]
    }
  },
  tracking: {
    contributions: [{
      amount: Number,
      date: {
        type: Date,
        default: Date.now
      },
      source: {
        type: String,
        enum: ['manual', 'automatic', 'bonus', 'refund', 'cashback'],
        default: 'manual'
      },
      description: String,
      transactionId: String
    }],
    progress: [{
      date: Date,
      amount: Number,
      percentage: Number,
      note: String
    }],
    analytics: {
      averageMonthlyContribution: Number,
      projectedCompletionDate: Date,
      velocityTrend: String, // 'accelerating', 'stable', 'slowing'
      lastCalculated: Date
    }
  },
  aiOptimization: {
    enabled: {
      type: Boolean,
      default: true
    },
    suggestions: [{
      type: String,
      message: String,
      impact: Number,
      confidence: Number,
      createdAt: {
        type: Date,
        default: Date.now
      },
      implemented: {
        type: Boolean,
        default: false
      }
    }],
    riskAssessment: {
      level: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      factors: [String],
      lastAssessed: Date
    },
    predictiveInsights: {
      likelihoodOfSuccess: Number,
      suggestedAdjustments: [String],
      alternativeStrategies: [String]
    }
  },
  notifications: {
    milestoneAlerts: {
      type: Boolean,
      default: true
    },
    progressReminders: {
      type: Boolean,
      default: true
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    customAlerts: [{
      condition: String,
      message: String,
      triggered: {
        type: Boolean,
        default: false
      }
    }]
  },
  sharing: {
    isPublic: {
      type: Boolean,
      default: false
    },
    sharedWith: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      permissions: {
        type: String,
        enum: ['view', 'contribute', 'manage'],
        default: 'view'
      },
      sharedDate: {
        type: Date,
        default: Date.now
      }
    }],
    supportGroup: {
      enabled: {
        type: Boolean,
        default: false
      },
      groupId: String,
      role: {
        type: String,
        enum: ['member', 'supporter', 'mentor']
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled', 'overdue'],
    default: 'active',
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
goalSchema.index({ user: 1, status: 1 });
goalSchema.index({ user: 1, type: 1 });
goalSchema.index({ user: 1, priority: 1 });
goalSchema.index({ user: 1, 'timeline.targetDate': 1 });
goalSchema.index({ 'recurringContribution.nextContributionDate': 1 });

// Virtual for progress percentage
goalSchema.virtual('progressPercentage').get(function() {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
});

// Virtual for remaining amount
goalSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.targetAmount - this.currentAmount);
});

// Virtual for days remaining
goalSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const targetDate = new Date(this.timeline.targetDate);
  const diffTime = targetDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for required daily savings
goalSchema.virtual('requiredDailySavings').get(function() {
  const daysRemaining = this.daysRemaining;
  if (daysRemaining <= 0) return 0;
  return Math.round(this.remainingAmount / daysRemaining);
});

// Virtual for current velocity
goalSchema.virtual('currentVelocity').get(function() {
  if (this.tracking.contributions.length < 2) return 0;
  
  const sortedContributions = this.tracking.contributions.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent = sortedContributions.slice(0, 5);
  
  const totalAmount = recent.reduce((sum, contrib) => sum + contrib.amount, 0);
  const timeSpan = new Date(recent[0].date) - new Date(recent[recent.length - 1].date);
  const days = timeSpan / (1000 * 60 * 60 * 24);
  
  return days > 0 ? totalAmount / days : 0;
});

// Pre-save middleware to update status
goalSchema.pre('save', function(next) {
  // Update status based on progress and dates
  if (this.currentAmount >= this.targetAmount && this.status !== 'completed') {
    this.status = 'completed';
    this.timeline.completedDate = new Date();
  } else if (new Date() > this.timeline.targetDate && this.status === 'active') {
    this.status = 'overdue';
  }
  
  // Update milestones
  this.milestones.forEach(milestone => {
    if (!milestone.achieved && this.currentAmount >= milestone.amount) {
      milestone.achieved = true;
      milestone.achievedDate = new Date();
    }
  });
  
  next();
});

// Method to add contribution
goalSchema.methods.addContribution = function(amount, source = 'manual', description = '', transactionId = null) {
  this.currentAmount += amount;
  
  this.tracking.contributions.push({
    amount: amount,
    source: source,
    description: description,
    transactionId: transactionId
  });
  
  // Add to progress tracking
  this.tracking.progress.push({
    date: new Date(),
    amount: this.currentAmount,
    percentage: this.progressPercentage,
    note: `Added ${amount} via ${source}`
  });
  
  this.updateAnalytics();
  return this.save();
};

// Method to update analytics
goalSchema.methods.updateAnalytics = function() {
  const contributions = this.tracking.contributions;
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
    this.tracking.analytics.projectedCompletionDate = projectedDate;
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
  }
  
  this.tracking.analytics.lastCalculated = new Date();
};

// Method to generate AI suggestions
goalSchema.methods.generateAISuggestions = function() {
  const suggestions = [];
  
  // Suggestion based on progress
  if (this.progressPercentage < 25 && this.daysRemaining < 30) {
    suggestions.push({
      type: 'urgency',
      message: 'Your goal is behind schedule. Consider increasing your contribution frequency.',
      impact: 0.8,
      confidence: 0.9
    });
  }
  
  // Suggestion based on velocity
  if (this.tracking.analytics.velocityTrend === 'slowing') {
    suggestions.push({
      type: 'motivation',
      message: 'Your savings velocity is decreasing. Try setting up automated contributions.',
      impact: 0.6,
      confidence: 0.7
    });
  }
  
  // Suggestion for milestone rewards
  const nextMilestone = this.milestones.find(m => !m.achieved);
  if (nextMilestone && this.currentAmount >= nextMilestone.amount * 0.9) {
    suggestions.push({
      type: 'milestone',
      message: `You're almost at your ${nextMilestone.percentage}% milestone! Just ${nextMilestone.amount - this.currentAmount} more to go.`,
      impact: 0.5,
      confidence: 1.0
    });
  }
  
  this.aiOptimization.suggestions = suggestions;
  return suggestions;
};

// Method to pause/resume goal
goalSchema.methods.togglePause = function() {
  if (this.status === 'active') {
    this.status = 'paused';
  } else if (this.status === 'paused') {
    this.status = 'active';
  }
  return this.save();
};

// Method to cancel goal
goalSchema.methods.cancel = function(reason = '') {
  this.status = 'cancelled';
  this.notes = this.notes ? `${this.notes}\n\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  return this.save();
};

// Method to archive goal
goalSchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

// Method to calculate risk assessment
goalSchema.methods.calculateRiskAssessment = function() {
  const factors = [];
  let riskLevel = 'low';
  
  // Check if goal is overdue
  if (this.status === 'overdue') {
    factors.push('Goal is overdue');
    riskLevel = 'high';
  }
  
  // Check progress vs time elapsed
  const totalDays = Math.ceil((this.timeline.targetDate - this.timeline.startDate) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((new Date() - this.timeline.startDate) / (1000 * 60 * 60 * 24));
  const timeProgress = elapsedDays / totalDays;
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
  if (this.requiredDailySavings > this.tracking.analytics.averageMonthlyContribution / 30 * 2) {
    factors.push('Required daily savings may be unrealistic');
    riskLevel = 'medium';
  }
  
  this.aiOptimization.riskAssessment = {
    level: riskLevel,
    factors: factors,
    lastAssessed: new Date()
  };
  
  return this.aiOptimization.riskAssessment;
};

// Static method to get active goals for user
goalSchema.statics.getActiveGoals = function(userId) {
  return this.find({
    user: userId,
    status: 'active',
    isArchived: false
  }).sort({ priority: -1, 'timeline.targetDate': 1 });
};

// Static method to get goals by priority
goalSchema.statics.getGoalsByPriority = function(userId, priority) {
  return this.find({
    user: userId,
    priority: priority,
    status: { $in: ['active', 'paused'] },
    isArchived: false
  }).sort({ 'timeline.targetDate': 1 });
};

// Static method to get overdue goals
goalSchema.statics.getOverdueGoals = function(userId) {
  return this.find({
    user: userId,
    status: 'overdue',
    isArchived: false
  }).sort({ 'timeline.targetDate': 1 });
};

// Static method to get goals needing attention
goalSchema.statics.getGoalsNeedingAttention = function(userId) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  return this.find({
    user: userId,
    status: 'active',
    isArchived: false,
    $or: [
      { 'timeline.targetDate': { $lte: thirtyDaysFromNow } },
      { status: 'overdue' }
    ]
  }).sort({ 'timeline.targetDate': 1 });
};

// Static method to get goals ready for recurring contribution
goalSchema.statics.getGoalsForRecurringContribution = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return this.find({
    'recurringContribution.enabled': true,
    'recurringContribution.nextContributionDate': { $lte: today },
    status: 'active',
    isArchived: false
  });
};

// Static method to get goal statistics for user
goalSchema.statics.getUserGoalStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId), isArchived: false } },
    {
      $group: {
        _id: null,
        totalGoals: { $sum: 1 },
        activeGoals: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        completedGoals: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalTargetAmount: { $sum: '$targetAmount' },
        totalCurrentAmount: { $sum: '$currentAmount' },
        overdueGoals: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } }
      }
    },
    {
      $addFields: {
        overallProgress: {
          $cond: [
            { $gt: ['$totalTargetAmount', 0] },
            { $multiply: [{ $divide: ['$totalCurrentAmount', '$totalTargetAmount'] }, 100] },
            0
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Goal', goalSchema);