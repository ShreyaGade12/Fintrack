const express = require('express');
// const mongoose = require('mongoose'); // REMOVE THIS LINE
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
require('dotenv').config(); // Load environment variables first

// Import Sequelize connection
const { sequelize, connectDB } = require('./db'); // ADD THIS LINE

// Initialize Firebase Admin SDK
const admin = require('firebase-admin');
// For local development, ensure you have your serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT_KEY env var set
try {
  // Option A: Load from environment variable (recommended for production)
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized from environment variable.');
} catch (e) {
  // Option B: Fallback to local file for development (less secure for production)
  // Make sure serviceAccountKey.json is in your backend root and NOT committed to Git
  console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found or invalid. Attempting to load from local file...');
  try {
    const serviceAccount = require('./serviceAccountKey.json'); // Adjust path if needed
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized from local file.');
  } catch (fileError) {
    console.error('Failed to initialize Firebase Admin SDK. Ensure serviceAccountKey.json exists or FIREBASE_SERVICE_ACCOUNT_KEY is set.', fileError);
    // Exit or handle gracefully if Firebase Admin is critical
    // process.exit(1);
  }
}


// Import middleware
const verifyFirebaseToken = require('./middleware/firebaseAuth');

// Import routes
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const analyticsRoutes = require('./routes/analytics');
const aiRoutes = require('./routes/ai');
const gmailRoutes = require('./routes/gmail');
const smsRoutes = require('./routes/sms');
const budgetRoutes = require('./routes/budget');
const goalRoutes = require('./routes/goals');
const userRoutes = require('./routes/users'); // Ensure this line is present and correct!

// Import services
const EmailParser = require('./services/emailParser');
const SmsParser = require('./services/smsParser');
const AIInsightsEngine = require('./services/aiInsights');
const NotificationService = require('./services/notifications');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || "http://localhost:3000", "https://generativelanguage.googleapis.com"], // Allow connections to LLM API
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to other modules (if needed, though direct import is often preferred)
app.set('io', io);

// Database connection (PostgreSQL)
// REMOVE Mongoose connection block
/*
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));
*/

// Routes
app.use('/api/auth', authRoutes);
// Apply Firebase token verification to protected routes
app.use('/api/expenses', verifyFirebaseToken, expenseRoutes);
app.use('/api/analytics', verifyFirebaseToken, analyticsRoutes);
app.use('/api/ai', verifyFirebaseToken, aiRoutes);
app.use('/api/gmail', verifyFirebaseToken, gmailRoutes);
app.use('/api/sms', verifyFirebaseToken, smsRoutes);
app.use('/api/budget', verifyFirebaseToken, budgetRoutes);
app.use('/api/goals', verifyFirebaseToken, goalRoutes);
app.use('/api/users', verifyFirebaseToken, userRoutes); // This line needs userRoutes to be defined

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') { // Mongoose Validation Error (will change for Sequelize)
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') { // ADD Sequelize validation errors
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors ? err.errors.map(e => e.message).join(', ') : err.message
    });
  }

  if (err.name === 'CastError') { // Mongoose Cast Error (will change for Sequelize)
    return res.status(400).json({
      error: 'Invalid ID format'
    });
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`
  });
});

// Scheduled tasks
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily expense sync...');
  try {
    await EmailParser.syncAllUsers();
    await SmsParser.syncAllUsers();
    await AIInsightsEngine.generateDailyInsights();
  } catch (error) {
    console.error('Daily sync error:', error);
  }
});

// Weekly insights generation
cron.schedule('0 10 * * 1', async () => {
  console.log('Generating weekly insights...');
  try {
    await AIInsightsEngine.generateWeeklyInsights();
    await NotificationService.sendWeeklyReports();
  } catch (error) {
    console.error('Weekly insights error:', error);
  }
});

// Monthly budget reset and analysis
cron.schedule('0 0 1 * *', async () => {
  console.log('Running monthly budget analysis...');
  try {
    await AIInsightsEngine.generateMonthlyInsights();
    await NotificationService.sendMonthlyReports();
  } catch (error) {
    console.error('Monthly analysis error:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    // mongoose.connection.close(false, () => { // REMOVE THIS BLOCK
    //   console.log('MongoDB connection closed.');
    //   process.exit(0);
    // });
    sequelize.close().then(() => { // ADD THIS BLOCK FOR SEQUELIZE
      console.log('PostgreSQL connection closed.');
      process.exit(0);
    }).catch(err => {
      console.error('Error closing PostgreSQL connection:', err);
      process.exit(1);
    });
  });
});

const PORT = process.env.PORT || 5000;

// Start the server only after connecting to the database
connectDB().then(() => { // ADD connectDB call here
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    // console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`); // REMOVE THIS LINE
    console.log(`📊 PostgreSQL: Connected`); // ADD THIS LINE
  });
}).catch(err => {
  console.error('Failed to start server due to database connection error:', err);
  process.exit(1);
});

module.exports = app;
