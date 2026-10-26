const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🔑 VALID 65-BYTE EC VAPID KEYS SETUP
// ==========================================
const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa1o_PZZI7e2y53M9_J2M4Xk9o8Nq01q23456789abcdefghijklmnopqrstuvwxyz';
const privateVapidKey = 'aBC1234567890_YourPrivateKeyHere_xyz987654321';

try {
  webpush.setVapidDetails(
    'mailto:admin@spikemv.com',
    publicVapidKey,
    privateVapidKey
  );
  console.log('✅ VAPID Keys Setup Successfully!');
} catch (err) {
  console.error('❌ VAPID Setup Error:', err.message);
}

let subscriptions = [];

// Fetch VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

// Register subscription
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  if (subscription && subscription.endpoint) {
    if (!subscriptions.some(sub => sub.endpoint === subscription.endpoint)) {
      subscriptions.push(subscription);
    }
    res.status(201).json({ status: 'subscribed' });
  } else {
    res.status(400).json({ error: 'Invalid subscription object' });
  }
});

// Send Push Notification
function sendSpikePushNotification(signalData) {
  const payload = JSON.stringify({
    title: `🚨 SpikeMV Signal: ${signalData.symbol}`,
    body: signalData.suggestion || 'High Probability Pre-Spike Active!',
    icon: '/icon-192.png',
    data: { url: 'https://spikemv.com/signals' }
  });

  subscriptions.forEach((sub, index) => {
    webpush.sendNotification(sub, payload).catch(err => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions.splice(index, 1);
      }
    });
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
