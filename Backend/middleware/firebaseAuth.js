    // middleware/firebaseAuth.js
    const admin = require('firebase-admin'); // Firebase Admin SDK

    const verifyFirebaseToken = async (req, res, next) => {
      // Get the ID token from the Authorization header
      const idToken = req.headers.authorization?.split('Bearer ')[1];

      if (!idToken) {
        return res.status(401).json({ message: 'No Firebase ID token provided.' });
      }

      try {
        // Verify the ID token using Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.firebaseUser = decodedToken; // Attach decoded Firebase user to request (contains uid, email, etc.)
        console.log('Firebase ID Token verified for UID:', decodedToken.uid);

        // Continue to the next middleware or route handler
        next();
      } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        // Handle different Firebase Auth errors
        if (error.code === 'auth/id-token-expired') {
          return res.status(403).json({ message: 'Firebase ID token has expired. Please log in again.' });
        }
        if (error.code === 'auth/argument-error') {
          return res.status(403).json({ message: 'Invalid Firebase ID token format.' });
        }
        return res.status(403).json({ message: 'Invalid or unauthorized Firebase ID token.' });
      }
    };

    module.exports = verifyFirebaseToken;
    