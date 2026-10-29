const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Firebase Admin SDK Initialization
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

// In-Memory Storage for Subscribed FCM Tokens
const subscribedTokens = new Set();
const lastNotifiedState = {};

// 🔑 1. VAPID Public Key Endpoint (Required by Lovable PWA / Browser)
app.get('/api/vapid-public-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Firebase/VAPID Public Key configured in Environment or Fallback
  const publicKey = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMvKeyPublicSpikeMvDemoKeyHere";
  return res.json({ publicKey });
});

// 📲 2. Push Notification Subscription Endpoint
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

// 🚀 3. Feed Update Endpoint (MT5 EA Data Receiver & Multicast Push Trigger)
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

  // Socket.io Real-Time Broadcast to Active Web UI
  io.emit('market-update', item);

  // Check if Early Warning or Active Signal Triggered (Pre-Spike score >= 3.9)
  const isSignalActive = scoreNum >= 3.9 || suggestionStr.includes('SPIKE') || suggestionStr.includes('DROP');

  if (isSignalActive && admin.apps.length > 0) {
    const lastAlert = lastNotifiedState[cleanSymbol];

    // Throttling: Prevent spamming notifications for the same pair within 3 minutes
    if (!lastAlert || (currentTime - lastAlert.time >= 3 * 60 * 1000)) {
      lastNotifiedState[cleanSymbol] = {
        time: currentTime,
        score: scoreNum
      };

      const tokensArray = Array.from(subscribedTokens);

      if (tokensArray.length > 0) {
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
          console.log(`✅ FCM Push Alert Sent for ${cleanSymbol}. Success: ${response.successCount}, Failed: ${response.failureCount}`);
        } catch (error) {
          console.error("❌ Firebase Multicast Error:", error);
        }
      }
    }
  }

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Server running on port ${PORT}`);
});
