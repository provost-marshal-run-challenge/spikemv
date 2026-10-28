const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve Static Frontend HTML Files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Firebase Admin Setup
if (!admin.apps.length) {
  try {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
      const serviceAccount = JSON.parse(rawAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("✅ Firebase Admin SDK Initialized Successfully!");
    } else {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT environment variable is missing!");
    }
  } catch (error) {
    console.error("❌ Firebase Admin Initialization Error:", error);
  }
}

// Global Market State Tracker & Subscriptions Storage
let latestMarketState = {};
let subscribedTokens = new Set();

// ⏳ Notification Spam Control Tracker (Track last alert time per pair)
let lastNotifiedState = {};

// Keep-Alive Endpoint for Cron-job.org
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fetch current state
app.get('/api/state', (req, res) => {
  res.json(latestMarketState);
});

// 🔔 Push Notification Subscription Endpoint
app.post('/api/subscribe-alerts', (req, res) => {
  const { token } = req.body;
  if (token) {
    subscribedTokens.add(token);
    console.log(`✅ New FCM Push Token Subscribed! (Total Active: ${subscribedTokens.size})`);
    return res.json({ status: 'ok', message: 'Subscribed successfully' });
  }
  res.status(400).json({ error: 'Token is required' });
});

// Function to broadcast Push Notifications via Firebase Cloud Messaging (FCM)
async function triggerPushNotification(item) {
  if (subscribedTokens.size === 0 || !admin.apps.length) return;

  const cleanSymbol = item.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const scoreNum = Number(item.score || 0);
  const trendStr = String(item.trend || '').toUpperCase();
  const suggestionStr = String(item.suggestion || '').toUpperCase();
  const currentTime = Date.now();

  // 🎯 1. Direct Active Signal Check: Checks trend OR suggestion text OR score >= 4.0
  const isSignalActive = scoreNum >= 4.0 || 
                         trendStr.includes('STRONG') || 
                         trendStr.includes('ACTIVE') || 
                         suggestionStr.includes('ACTIVE') ||
                         suggestionStr.includes('BREAKOUT');

  if (!isSignalActive) return;

  // ⏳ 2. Smart Cooldown (3 Minutes / 180,000 ms): Prevents spam while ensuring timely alerts
  const lastAlert = lastNotifiedState[cleanSymbol];
  if (lastAlert && (currentTime - lastAlert.time < 3 * 60 * 1000)) {
    return; // Skip duplicate notification within 3 mins
  }

  // Record timestamp
  lastNotifiedState[cleanSymbol] = {
    time: currentTime,
    score: scoreNum
  };

  const tokensArray = Array.from(subscribedTokens);

  const message = {
    notification: {
      title: `🚨 SpikeMV Signal: ${cleanSymbol}`,
      body: `Score: ${item.score}/5.0 | ${item.suggestion || 'High Conviction Signal Active!'}`
    },
    data: {
      symbol: cleanSymbol,
      score: String(item.score),
      trend: trendStr
    },
    tokens: tokensArray
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`🚀 Single FCM Alert Broadcasted for ${cleanSymbol}: ${response.successCount} successful`);
  } catch (error) {
    console.error("❌ FCM Push Error:", error);
  }
}

// 📈 MT5 WebRequest Feed Endpoint
app.post('/api/update-feed', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.symbol) {
      return res.status(400).json({ error: 'Invalid payload. Symbol required.' });
    }

    const cleanSymbol = item.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    latestMarketState[cleanSymbol] = item;

    // Real-time Socket.io Broadcast
    io.emit('market_update', {
      symbol: cleanSymbol,
      latest: item,
      allPairs: latestMarketState
    });

    // Trigger FCM Alert if signal conditions & cooldown rules pass
    triggerPushNotification(item);

    res.status(200).json({ status: 'success', symbol: cleanSymbol });
  } catch (err) {
    console.error("❌ Feed Update Error:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log(`⚡ Client connected to Socket.io: ${socket.id}`);
  
  // Send existing state to new client immediately
  socket.emit('market_update', { allPairs: latestMarketState });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Live Feed & Alert Server running on port ${PORT}`);
});
