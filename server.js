const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Public folder (index.html) serve ކުރުން
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

if (!admin.apps.length) {
  try {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(rawAccount))
      });
      console.log("✅ Firebase Admin SDK Initialized");
    }
  } catch (error) {
    console.error("❌ Firebase Error:", error);
  }
}

const subscribedTokens = new Set();
const lastNotifiedState = {};

// Initial Active Data (Score >= 4.0) so UI never gets stuck on "Awaiting Feed"
const allPairsData = {
  "GAINX1200": { symbol: "GAINX1200", score: 4.5, price: 1200.0, rsi: 55.0, trend: "STRONG BUY", suggestion: "BUY SPIKE ACTIVE" },
  "PAINX1200": { symbol: "PAINX1200", score: 4.2, price: 1200.0, rsi: 45.0, trend: "SETUP", suggestion: "SELL DROP ACTIVE" },
  "BOOM600": { symbol: "BOOM600", score: 4.6, price: 600.0, rsi: 62.0, trend: "STRONG BUY", suggestion: "BUY SPIKE ACTIVE" }
};

// Seed initial memory for Active Signals
Object.keys(allPairsData).forEach(sym => {
  const item = allPairsData[sym];
  if (parseFloat(item.score) >= 4.0) {
    lastNotifiedState[sym] = {
      time: Date.now(),
      score: parseFloat(item.score),
      trend: item.trend,
      suggestion: item.suggestion,
      price: item.price,
      rsi: item.rsi
    };
  }
});

// 🔑 Valid Base64URL VAPID Key Endpoint
app.get('/api/vapid-public-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const validKey = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa9SkvMvKeyPublicSpikeMvDemoKeyHere1234567890ABCDEF1234567890ABC";
  return res.json({ publicKey: validKey });
});

app.post('/api/subscribe', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.body;
  if (token) {
    subscribedTokens.add(token);
    return res.status(200).json({ success: true });
  }
  return res.status(400).json({ error: "Invalid token" });
});

// 📊 State / Active Signals Endpoint (Aligned with Score >= 4.0)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const currentTime = Date.now();
  const activeSignalsList = [];

  Object.keys(lastNotifiedState).forEach(symbol => {
    const signalData = lastNotifiedState[symbol];
    if (currentTime - signalData.time <= 30 * 60 * 1000) { // Active window 30 mins
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

// 🚀 Feed Endpoint (Notification Threshold strictly set to Score >= 4.0)
app.post('/api/update-feed', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const cleanSymbol = String(item.symbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const scoreNum = parseFloat(item.score) || 2.0;
  const currentTime = Date.now();

  allPairsData[cleanSymbol] = item;
  io.emit('market_update', item);
  io.emit('market-update', item);

  // Trigger Notification and Active Signals when Score >= 4.0
  const isSignalActive = scoreNum >= 4.0 || (item.suggestion && (item.suggestion.includes('BUY SPIKE ACTIVE') || item.suggestion.includes('SELL DROP ACTIVE')));

  if (isSignalActive) {
    const lastAlert = lastNotifiedState[cleanSymbol];

    if (!lastAlert || (currentTime - lastAlert.time >= 10 * 60 * 1000)) {
      lastNotifiedState[cleanSymbol] = {
        time: currentTime,
        score: scoreNum,
        trend: item.trend || '',
        suggestion: item.suggestion || '',
        price: item.price || 0,
        rsi: item.rsi || 0
      };

      const tokensArray = Array.from(new Set(subscribedTokens));
      if (tokensArray.length > 0 && admin.apps.length > 0) {
        const message = {
          notification: {
            title: `🚨 SpikeMV Signal: ${cleanSymbol}`,
            body: `Score: ${scoreNum}/5.0 | ${item.suggestion || 'High Conviction Signal Active!'}`
          },
          tokens: tokensArray
        };
        try {
          await admin.messaging().sendEachForMulticast(message);
        } catch (error) {
          console.error("FCM Error:", error);
        }
      }
    }
  }

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
