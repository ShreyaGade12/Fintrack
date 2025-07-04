// db.js
const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load environment variables

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false, // Set to true to see SQL queries in console
  dialectOptions: {
    ssl: {
      require: true, // Required for many cloud PostgreSQL providers (e.g., Heroku, Azure DB for PostgreSQL)
      rejectUnauthorized: false // Important for self-signed certificates or some cloud setups
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import your Sequelize models here so they are registered with the sequelize instance
const User = require('./models/User');
const Expense = require('./models/Expense');
const Budget = require('./models/Budget');
const Goal = require('./models/Goal');

// Define associations after all models are defined
// (These are already defined within each model file, but Sequelize needs them to be loaded)
// User.hasMany(Expense, { foreignKey: 'user_id', as: 'expenses' });
// Expense.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
// User.hasMany(Budget, { foreignKey: 'user_id', as: 'budgets' });
// Budget.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
// User.hasMany(Goal, { foreignKey: 'user_id', as: 'goals' });
// Goal.belongsTo(User, { foreignKey: 'user_id', as: 'user' });


const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connection has been established successfully.');

    // Synchronize all models with the database.
    // `alter: true` will check the current state of the table in the database
    // and make the necessary changes to match the model.
    // Use `force: true` ONLY IN DEVELOPMENT to drop and re-create tables.
    // WARNING: `force: true` will drop existing tables and data!
    await sequelize.sync({ alter: true }); // Use alter: true for schema changes without data loss (mostly)
    console.log('All models were synchronized successfully.');

  } catch (error) {
    console.error('Unable to connect to the PostgreSQL database:', error);
    process.exit(1); // Exit process with failure
  }
};

module.exports = { sequelize, connectDB, User, Expense, Budget, Goal }; // Export models for use in routes
