    // routes/sms.js
    const express = require('express');
    const router = express.Router();
    const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware

    // Protect all SMS routes
    router.use(verifyFirebaseToken);

    // Placeholder for SMS sync
    router.post('/sync', (req, res) => {
      res.status(200).json({ message: 'SMS sync initiated!', userId: req.firebaseUser.uid });
    });

    module.exports = router;
    