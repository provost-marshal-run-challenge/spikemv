const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// 1. Firebase Admin SDK Initialization
if (!admin.apps.length) {
  try {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
      const serviceAccount = JSON.parse(rawAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin SDK Initialized Successfully.");
    }
  } catch (error) {
    console.error("❌ Firebase Initialization Error:", error);
  }
}

// Global In-Memory Storage
const subscribedTokens = new Set();
const lastNotifiedState = {};

// 🔑 VAPID Public Key Endpoint for Web Push
app.get('/api/vapid-public-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const publicKey = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa9SkvMvKeyPublicSpikeMvDemoKeyHere1234567890ABCDEF";
  return res.json({ publicKey });
});

// 📲 Push Notification Subscription Endpoint
app.post('/api/subscribe', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.body;

  if (token) {
    subscribedTokens.add(token);
    console.log(`✅ New FCM Push Token Subscribed: ${token.substring(0, 15)}...`);
    return res.status(200).json({ success: true, message: "Subscription registered successfully!" });
  }

  return res.status(400).json({ error: "Invalid token structure" });
});

// 📊 State / Feed Status Endpoint (Lovable fallback check)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json({ status: "online", activeSignals: Object.keys(lastNotifiedState).length });
});

// 🚀 MT5 Feed Receiver & Real-time Signal Processor
app.post('/api/update-feed', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid market payload" });
  }

  const cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '');
  const scoreNum = parseFloat(item.score) || 2.0;
  const currentTime = Date.now();
  const suggestionStr = String(item.suggestion || '').toUpperCase();

  // Socket.io Real-Time UI Broadcast
  io.emit('market-update', item);
  io.emit('market_update', item);

  // Signal Triggering Rules
  const isSignalActive = scoreNum >= 4.5 || suggestionStr.includes('BUY SPIKE ACTIVE') || suggestionStr.includes('SELL DROP ACTIVE');

  if (isSignalActive) {
    const lastAlert = lastNotifiedState[cleanSymbol];

    // Throttling: Prevent spamming within 10 minutes
    if (!lastAlert || (currentTime - lastAlert.time >= 10 * 60 * 1000)) {
      
      lastNotifiedState[cleanSymbol] = {
        time: currentTime,
        score: scoreNum,
        trend: item.trend || '',
        suggestion: item.suggestion || ''
      };

      const tokensArray = Array.from(new Set(subscribedTokens));

      if (tokensArray.length > 0 && admin.apps.length > 0) {
        const message = {
          notification: {
            title: `🚨 SpikeMV Signal: ${cleanSymbol}`,
            body: `Score: ${scoreNum}/5.0 | ${item.suggestion || 'High Conviction Signal Active!'}`
          },
          data: {
            symbol: cleanSymbol,
            score: String(scoreNum)
          },
          tokens: tokensArray
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(`✅ Push Alert Sent for ${cleanSymbol}. Success: ${response.successCount}`);
        } catch (error) {
          console.error("❌ Firebase Multicast Error:", error);
        }
      }
    }
  }

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

// Catch-all route for Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Server running on port ${PORT}`);
});
