// routes/ai.js
const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/firebaseAuth'); // Import middleware
const AIInsightsEngine = require('../services/aiInsights'); // Import the AIInsightsEngine service

// Protect all AI routes
router.use(verifyFirebaseToken);

router.post('/chat', async (req, res) => {
  const { message, userId } = req.body;

  // Ensure the userId from the request body matches the authenticated Firebase UID
  if (req.firebaseUser.uid !== userId) {
    return res.status(403).json({ message: 'Unauthorized: User ID mismatch.' });
  }

  try {
    // Call the AIInsightsEngine to get a response from Gemini
    const aiReply = await AIInsightsEngine.getAICoachResponse(userId, message);
    res.status(200).json({ reply: aiReply });

  } catch (error) {
    console.error('Error with AI chat:', error);
    res.status(500).json({ message: 'Error processing AI request.', error: error.message });
  }
});

module.exports = router;
