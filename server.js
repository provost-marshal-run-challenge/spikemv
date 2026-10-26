const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🔥 FIREBASE ADMIN SETUP (FCM PUSH ALERTS)
// ==========================================
// Initialize Firebase Admin with project ID
admin.initializeApp({
  projectId: "spike-mv"
});

let fcmTokens = [];

// Register FCM Push Token from Frontend
app.post('/api/subscribe', (req, res) => {
  const { fcmToken } = req.body;
  if (fcmToken) {
    if (!fcmTokens.includes(fcmToken)) {
      fcmTokens.push(fcmToken);
      console.log('✅ New FCM Token Subscribed:', fcmToken);
    }
    res.status(201).json({ status: 'subscribed' });
  } else {
    res.status(400).json({ error: 'Invalid FCM token' });
  }
});

// Helper Function: Send Push Alert via Firebase FCM
function sendSpikePushNotification(signalData) {
  if (fcmTokens.length === 0) return;

  const message = {
    notification: {
      title: `🚨 SpikeMV Signal: ${signalData.symbol}`,
      body: signalData.suggestion || 'High Probability Pre-Spike Active!'
    },
    tokens: fcmTokens
  };

  admin.messaging().sendMulticast(message)
    .then(response => {
      console.log(`🚀 FCM Push Alerts sent: ${response.successCount} successful`);
    })
    .catch(error => {
      console.error('❌ FCM Send Error:', error);
    });
}

// ==========================================
// 📊 SOCKET & MARKET DATA STORE
// ==========================================
let marketStore = {};

io.on('connection', (socket) => {
  console.log('⚡ New Client Connected to Dashboard');
  socket.emit('market_update', { allPairs: marketStore });
});

// MT5 WebRequest API Endpoint
app.post('/api/update', (req, res) => {
  const data = req.body;
  if (data && data.symbol) {
    const cleanSymbol = data.symbol.toUpperCase().trim();
    marketStore[cleanSymbol] = {
      ...data,
      symbol: cleanSymbol,
      updatedAt: new Date().getTime()
    };

    console.log(`✅ MT5 WebRequest Received: ${cleanSymbol} | Price: ${data.price}`);

    io.emit('market_update', {
      latest: marketStore[cleanSymbol],
      allPairs: marketStore
    });

    if (parseFloat(data.score) >= 4.3) {
      sendSpikePushNotification(data);
    }
  }
  res.status(200).json({ status: "success", message: "Data broadcasted successfully" });
});

app.get('/api/state', (req, res) => {
  res.status(200).json(marketStore);
});

app.get('/health', (req, res) => {
  res.status(200).send("SpikeMV Backend Active");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Weltrade Analytics Server running on port ${PORT}`);
});
