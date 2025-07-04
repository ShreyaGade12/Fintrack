// server.js (or new firebaseAdmin.js)
const admin = require('firebase-admin');
// For local development, ensure dotenv is loaded first if using .env file
require('dotenv').config();

// Parse the service account key from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Firebase Admin SDK initialized.');

// If this is in a separate file, export admin:
// module.exports = admin;