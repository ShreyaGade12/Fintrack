// models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../db'); // Import the sequelize instance
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  firebaseUid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'firebase_uid' // Use snake_case for database column
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Name is required' },
      len: { args: [1, 50], msg: 'Name cannot exceed 50 characters' }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: 'Please enter a valid email' },
      notEmpty: { msg: 'Email is required' },
      len: { args: [1, 100], msg: 'Email cannot exceed 100 characters' }
    }
  },
  password: {
    type: DataTypes.STRING, // Store hashed password
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Password is required' },
      len: { args: [6, 255], msg: 'Password must be at least 6 characters' }
    }
  },
  profilePicture: {
    type: DataTypes.STRING,
    defaultValue: null,
    field: 'profile_picture'
  },
  phone: {
    type: DataTypes.STRING(20),
    validate: {
      is: { args: /^[0-9]{10}$/, msg: 'Please enter a valid phone number' }
    }
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    field: 'date_of_birth'
  },
  occupation: {
    type: DataTypes.STRING(100)
  },
  monthlyIncome: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    validate: {
      min: { args: 0, msg: 'Monthly income cannot be negative' }
    },
    field: 'monthly_income'
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR',
    validate: {
      isIn: [['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD']]
    }
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'Asia/Kolkata'
  },
  preferences: {
    type: DataTypes.JSONB, // Store as JSONB for flexible schema
    defaultValue: {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
        weeklyReport: true,
        monthlyReport: true,
        budgetAlerts: true,
        emotionalSpendingAlerts: true
      },
      privacy: {
        dataSharing: false,
        anonymousMode: false,
        localMLOnly: true
      }
    }
  },
  integrations: {
    type: DataTypes.JSONB,
    defaultValue: {
      gmail: { enabled: false, accessToken: null, refreshToken: null, lastSync: null },
      sms: { enabled: false, lastSync: null },
      bankAccounts: []
    }
  },
  aiProfile: {
    type: DataTypes.JSONB,
    defaultValue: {
      spendingPersonality: 'moderate',
      emotionalTriggers: [],
      riskTolerance: 'medium',
      financialGoals: [],
      lastAIInteraction: null,
      aiModelPreference: 'basic'
    },
    field: 'ai_profile'
  },
  securitySettings: {
    type: DataTypes.JSONB,
    defaultValue: {
      twoFactorAuth: { enabled: false, secret: null },
      loginAttempts: 0,
      lastLogin: null,
      lockUntil: null,
      passwordResetToken: null,
      passwordResetExpires: null
    },
    field: 'security_settings'
  },
  subscription: {
    type: DataTypes.JSONB,
    defaultValue: {
      plan: 'free',
      status: 'active',
      startDate: DataTypes.NOW,
      endDate: null,
      autoRenew: false
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified'
  },
  verificationToken: {
    type: DataTypes.STRING,
    field: 'verification_token'
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_active'
  }
}, {
  tableName: 'users', // Define the table name
  timestamps: true, // Adds createdAt and updatedAt columns
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to increment login attempts
User.prototype.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.securitySettings.lockUntil && new Date(this.securitySettings.lockUntil) < new Date()) {
    this.securitySettings.lockUntil = null;
    this.securitySettings.loginAttempts = 1;
  } else {
    this.securitySettings.loginAttempts = (this.securitySettings.loginAttempts || 0) + 1;
  }

  // Lock account after 5 failed attempts for 2 hours
  if (this.securitySettings.loginAttempts >= 5 && !this.isLocked) {
    this.securitySettings.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
  }
  await this.save();
};

// Instance method to reset login attempts
User.prototype.resetLoginAttempts = async function() {
  this.securitySettings.lockUntil = null;
  this.securitySettings.loginAttempts = 0;
  await this.save();
};

// Instance method to update last active
User.prototype.updateLastActive = async function() {
  this.lastActive = new Date();
  await this.save();
};

// Virtual for account lock status (getter)
Object.defineProperty(User.prototype, 'isLocked', {
  get() {
    return !!(this.securitySettings.lockUntil && new Date(this.securitySettings.lockUntil) > new Date());
  }
});

module.exports = User;
