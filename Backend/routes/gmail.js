    // routes/gmail.js
    const express = require('express');
    const router = express.Router();
    const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware

    // Protect all Gmail routes
    router.use(verifyFirebaseToken);

    // Placeholder for Gmail sync
    router.post('/sync', (req, res) => {
      res.status(200).json({ message: 'Gmail sync initiated!', userId: req.firebaseUser.uid });
    });

    module.exports = router;
    