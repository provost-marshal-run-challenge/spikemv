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

if (!admin.apps.length) {
  try {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawAccount) {
      const serviceAccount = JSON.parse(rawAccount);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error("❌ Firebase Initialization Error:", error);
  }
}

let latestMarketState = {};
let subscribedTokens = new Set();
let lastNotifiedState = {};
let signalActivatedTimes = {};

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/state', (req, res) => {
  res.json(latestMarketState);
});

app.post('/api/subscribe-alerts', (req, res) => {
  const { token } = req.body;
  if (token) {
    subscribedTokens.add(token);
    return res.json({ status: 'ok', message: 'Subscribed successfully' });
  }
  res.status(400).json({ error: 'Token is required' });
});

async function triggerPushNotification(item) {
  if (subscribedTokens.size === 0 || !admin.apps.length) return;

  const cleanSymbol = item.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const scoreNum = Number(item.score || 0);
  const trendStr = String(item.trend || '').toUpperCase();
  const suggestionStr = String(item.suggestion || '').toUpperCase();
  const currentTime = Date.now();

  const isSignalActive = scoreNum >= 4.0 || 
                         trendStr.includes('STRONG') || 
                         trendStr.includes('ACTIVE') || 
                         suggestionStr.includes('ACTIVE') ||
                         suggestionStr.includes('SPIKE') ||
                         suggestionStr.includes('DROP');

  if (!isSignalActive) return;

  const lastAlert = lastNotifiedState[cleanSymbol];
  if (lastAlert && (currentTime - lastAlert.time < 3 * 60 * 1000)) {
    return;
  }

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
    await admin.messaging().sendEachForMulticast(message);
  } catch (error) {
    console.error("❌ FCM Push Error:", error);
  }
}

app.post('/api/update-feed', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.symbol) {
      return res.status(400).json({ error: 'Invalid payload. Symbol required.' });
    }

    let rawSymbol = item.symbol.toUpperCase();
    let cleanSymbol = rawSymbol;

    // Standardize Deriv & Weltrade Brokers
    if (rawSymbol.includes('BOOM') || rawSymbol.includes('CRASH')) {
      const match = rawSymbol.match(/(BOOM|CRASH)\s*(\d+)/i);
      if (match) {
        cleanSymbol = `${match[1]} ${match[2]}`;
      }
      item.broker = 'Deriv';
    } else {
      item.broker = 'Weltrade';
    }

    item.symbol = cleanSymbol;
    const rsiVal = Number(item.rsi || 50);
    const p = Number(item.price || 0);
    const currentTime = Date.now();

    const isBoom = cleanSymbol.includes('BOOM');
    const isCrash = cleanSymbol.includes('CRASH');

    if (isBoom) {
      item.fibonacci = rsiVal <= 35 ? "0.618 - OTE Golden Zone Active" : "0.382 Retracement Level";
      item.orderBlock = rsiVal <= 35 ? "Bullish Demand Block Reversal Zone" : "Neutral Order Block";
      item.liquiditySweep = rsiVal <= 30 ? "Liquidity Sweep Completed below Support" : "Building Sell-side Liquidity";
      item.supportResistance = `Demand Support Pool: ${(p * 0.998).toFixed(2)}`;
      item.resistance = `Supply Resistance Ceiling: ${(p * 1.005).toFixed(2)}`;
      item.candlestickPattern = rsiVal <= 32 ? "Institutional Bullish Pin Bar" : "Consolidation Range Candle";
    } else if (isCrash) {
      item.fibonacci = rsiVal >= 65 ? "0.786 - OTE Golden Zone Active" : "0.50 Premium Zone";
      item.orderBlock = rsiVal >= 65 ? "Bearish Supply Block Reversal Zone" : "Neutral Order Block";
      item.liquiditySweep = rsiVal >= 70 ? "Liquidity Sweep Completed above Resistance" : "Building Buy-side Liquidity";
      item.supportResistance = `Demand Support Level: ${(p * 0.995).toFixed(2)}`;
      item.resistance = `Supply Resistance Pool: ${(p * 1.002).toFixed(2)}`;
      item.candlestickPattern = rsiVal >= 68 ? "Institutional Bearish Engulfing" : "Consolidation Range Candle";
    }

    // Spike / Drop Logic for Deriv
    if (item.broker === 'Deriv') {
      if (isBoom) {
        if (rsiVal <= 28.0) {
          item.score = 4.9;
          item.trend = "STRONG SPIKE ZONE";
          item.suggestion = `⚡ [${cleanSymbol} BUY SPIKE ACTIVE]: Oversold Zone! High Probability Buy Spike`;
        } else if (rsiVal <= 38.0) {
          item.score = 3.9;
          item.trend = "PRE-SPIKE SETUP (3-5 MINS)";
          item.suggestion = `⏳ [${cleanSymbol} EARLY WARNING]: Approaching Spike Support Zone`;
        } else {
          item.score = 2.0;
          item.trend = "MONITORING";
          item.suggestion = "⏳ Analyzing Market Structure...";
        }
      } else if (isCrash) {
        if (rsiVal >= 72.0) {
          item.score = 4.9;
          item.trend = "STRONG DROP ZONE";
          item.suggestion = `⚡ [${cleanSymbol} SELL DROP ACTIVE]: Overbought Zone! High Probability Sell Drop`;
        } else if (rsiVal >= 62.0) {
          item.score = 3.9;
          item.trend = "PRE-DROP SETUP (3-5 MINS)";
          item.suggestion = `⏳ [${cleanSymbol} EARLY WARNING]: Approaching Drop Resistance Zone`;
        } else {
          item.score = 2.0;
          item.trend = "MONITORING";
          item.suggestion = "⏳ Analyzing Market Structure...";
        }
      }
    }

    const isSignalActive = Number(item.score) >= 4.3 || 
                           String(item.trend).includes('STRONG') || 
                           String(item.suggestion).includes('ACTIVE') ||
                           String(item.suggestion).includes('SPIKE') ||
                           String(item.suggestion).includes('DROP');

    if (isSignalActive) {
      if (!signalActivatedTimes[cleanSymbol]) {
        signalActivatedTimes[cleanSymbol] = currentTime;
      }
    } else {
      delete signalActivatedTimes[cleanSymbol];
    }

    item.firstTriggeredAt = signalActivatedTimes[cleanSymbol] || currentTime;
    latestMarketState[cleanSymbol] = item;

    io.emit('market_update', {
      symbol: cleanSymbol,
      latest: item,
      allPairs: latestMarketState
    });

    triggerPushNotification(item);

    res.status(200).json({ status: 'success', symbol: cleanSymbol });
  } catch (err) {
    console.error("❌ Feed Update Error:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

io.on('connection', (socket) => {
  socket.emit('market_update', { allPairs: latestMarketState });
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Server running on port ${PORT}`);
});
