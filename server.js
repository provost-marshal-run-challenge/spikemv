const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

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

// Global Market State Tracker
let latestMarketState = {};

// MT5 Data Endpoint
app.post('/api/update-feed', (req, res) => {
  const data = req.body;
  if (data && data.symbol) {
    latestMarketState[data.symbol] = data;
    io.emit('market_update', data); // Broadcast live to dashboard

    // Push alert for score >= 4.3
    if (data.score >= 4.3 && data.fcmTokens) {
      triggerPushNotification(data, data.fcmTokens);
    }
  }
  res.json({ status: 'ok', timestamp: new Date() });
});

// REST Endpoint for Lovable Dashboard
app.get('/api/state', (req, res) => {
  res.json(latestMarketState);
});

// Root Health Check
app.get('/', (req, res) => {
  res.send("SpikeMV Live Feed Engine Running!");
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log('⚡ Client connected to Socket.io:', socket.id);
  socket.emit('initial_state', latestMarketState);

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

async function triggerPushNotification(signalData, fcmTokens) {
  if (!fcmTokens || fcmTokens.length === 0) return;
  const message = {
    notification: {
      title: `🚨 SpikeMV Signal: ${signalData.symbol}`,
      body: `Score: ${signalData.score} | ${signalData.suggestion || 'High Probability Active!'}`
    },
    tokens: fcmTokens
  };
  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`🚀 FCM Push Alerts sent: ${response.successCount} successful`);
  } catch (error) {
    console.error("❌ FCM Send Error:", error);
  }
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Live Feed & Alert Server running on port ${PORT}`);
});
