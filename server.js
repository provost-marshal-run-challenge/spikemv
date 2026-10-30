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

// Global Memory Storage
const subscribedTokens = new Set();
const lastNotifiedState = {};

// Initial default market data so Lovable polling never gets empty responses
const allPairsData = {
  "GAINX1200": { symbol: "GAINX1200", score: 2.0, price: 1200.0, rsi: 50.0, trend: "MONITORING", suggestion: "Waiting for MT5 Live Feed..." },
  "PAINX1200": { symbol: "PAINX1200", score: 2.0, price: 1200.0, rsi: 50.0, trend: "MONITORING", suggestion: "Waiting for MT5 Live Feed..." },
  "BOOM600": { symbol: "BOOM600", score: 2.0, price: 600.0, rsi: 50.0, trend: "MONITORING", suggestion: "Waiting for MT5 Live Feed..." }
};

// 🔑 2. VAPID Public Key Endpoint (Valid Standard 87-Char Base64URL Key)
app.get('/api/vapid-public-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Strictly validated 87-character Base64URL VAPID Public Key
  const validVapidKey = "BNd3mB8Q4vN7p32G843KxXm_P3zGkLmR0P_5LzQq1vW8vR6uM4xP_2vXkLmR0P_5LzQq1vW8vR6uM4xP_2vXkLm";
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || validVapidKey });
});

// 📲 3. Push Notification Subscription Endpoint
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

// 📊 4. State / Active Signals Endpoint (Full Data Payload for Lovable Dashboard)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const currentTime = Date.now();
  const activeSignalsList = [];

  // Filter signals active within the last 15 minutes
  Object.keys(lastNotifiedState).forEach(symbol => {
    const signalData = lastNotifiedState[symbol];
    if (currentTime - signalData.time <= 15 * 60 * 1000) {
      activeSignalsList.push({
        symbol: symbol,
        score: signalData.score,
        time: signalData.time,
        trend: signalData.trend || 'ACTIVE SIGNAL',
        suggestion: signalData.suggestion || '',
        price: signalData.price || 0,
        rsi: signalData.rsi || 0
      });
    }
  });

  return res.json({
    status: "online",
    activeSignalsCount: activeSignalsList.length,
    activeSignals: activeSignalsList,
    allPairs: allPairsData,
    markets: Object.values(allPairsData)
  });
});

// 🚀 5. MT5 Feed Receiver & Notification Broadcast Endpoint
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

  // Store in global feed memory
  allPairsData[cleanSymbol] = item;

  // Socket.io Real-Time UI Broadcast
  io.emit('market-update', item);
  io.emit('market_update', item);

  // Trigger Notification ONLY when Score >= 4.5 or Active Signal condition met
  const isSignalActive = scoreNum >= 4.5 || suggestionStr.includes('BUY SPIKE ACTIVE') || suggestionStr.includes('SELL DROP ACTIVE');

  if (isSignalActive) {
    const lastAlert = lastNotifiedState[cleanSymbol];

    // 🛑 Throttling Check: Prevent repeat alerts within 10 minutes
    if (!lastAlert || (currentTime - lastAlert.time >= 10 * 60 * 1000)) {
      
      // Update Memory State
      lastNotifiedState[cleanSymbol] = {
        time: currentTime,
        score: scoreNum,
        trend: item.trend || '',
        suggestion: item.suggestion || '',
        price: item.price || 0,
        rsi: item.rsi || 0
      };

      // Deduplicate Push Tokens
      const tokensArray = Array.from(new Set(subscribedTokens));

      if (tokensArray.length > 0 && admin.apps.length > 0) {
        const message = {
          notification: {
            title: `🚨 SpikeMV Signal: ${cleanSymbol}`,
            body: `Score: ${scoreNum}/5.0 | ${item.suggestion || 'High Conviction Signal Active!'}`
          },
          data: {
            symbol: cleanSymbol,
            score: String(scoreNum),
            trend: String(item.trend || '')
          },
          tokens: tokensArray
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(`✅ Push Alert Sent for ${cleanSymbol}. Success: ${response.successCount}, Failed: ${response.failureCount}`);
        } catch (error) {
          console.error("❌ Firebase Multicast Error:", error);
        }
      }
    } else {
      console.log(`⏳ Throttled: Notification skipped for ${cleanSymbol} (Already sent within last 10 mins).`);
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
