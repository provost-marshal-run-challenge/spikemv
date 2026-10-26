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
// 🔑 VAPID KEYS & WEB PUSH SETUP
// ==========================================
const publicVapidKey = 'BFmKk2Nmsv8GkYt8QjE3q3vQ0XyL1mN4P5q6R7s8T9u0V1w2X3y4Z5a6B7c8D9e0F1g2H3i4J5k6L7m8N9o0P1';
const privateVapidKey = '4zK8mP9xL2vR7qW1yT5uI3oO6aS8dF0gH2jK4lM6nP8';

webpush.setVapidDetails(
  'mailto:admin@spikemv.com',
  publicVapidKey,
  privateVapidKey
);

let subscriptions = [];

// Endpoint to fetch public VAPID key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: publicVapidKey });
});

// Endpoint to register client push subscription
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
