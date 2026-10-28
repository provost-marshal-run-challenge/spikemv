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
                         suggestionStr.includes('BREAKOUT') ||
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

    // Standardize Deriv Symbol Names (e.g., "BOOM 1000 INDEX" -> "BOOM 1000")
    if (rawSymbol.includes('BOOM') || rawSymbol.includes('CRASH')) {
      const match = rawSymbol.match(/(BOOM|CRASH)\s*(\d+)/i);
      if (match) {
        cleanSymbol = `${match[1]} ${match[2]}`;
      }
      item.broker = 'Deriv';
    } else if (rawSymbol.includes('XAUUSD')) {
      cleanSymbol = 'XAUUSD';
      item.broker = 'IC Markets';
    } else {
      item.broker = 'Weltrade';
    }

    item.symbol = cleanSymbol;
    const rsiVal = Number(item.rsi || 50);
    const currentTime = Date.now();

    // 1. 🪙 XAUUSD (Gold) Logic - IC Markets
    if (cleanSymbol === 'XAUUSD') {
      if (rsiVal <= 32.0) {
        item.score = 4.9;
        item.trend = "STRONG BULLISH SMC";
        item.suggestion = "⚡ [GOLD BUY ACTIVE]: Institutional Liquidity Sweep + Order Block Reversal!";
      } else if (rsiVal >= 68.0) {
        item.score = 4.9;
        item.trend = "STRONG BEARISH SMC";
        item.suggestion = "⚡ [GOLD SELL ACTIVE]: Institutional Bearish Order Block Breakout!";
      } else if (rsiVal > 32.0 && rsiVal < 45.0) {
        item.score = 3.8;
        item.trend = "BULLISH ACCUMULATION";
        item.suggestion = "⏳ [GOLD WATCHLIST]: Bullish Liquidity Building near Support";
      } else if (rsiVal > 55.0 && rsiVal < 68.0) {
        item.score = 3.8;
        item.trend = "BEARISH DISTRIBUTION";
        item.suggestion = "⏳ [GOLD WATCHLIST]: Bearish Liquidity Building near Resistance";
      } else {
        item.score = 2.5;
        item.trend = "CONSOLIDATION";
        item.suggestion = "⏳ [GOLD MONITORING]: Range-bound Market Structure";
      }
    } 
    // 2. 🎯 Deriv Boom & Crash Indices Logic
    else if (item.broker === 'Deriv') {
      const isBoom = cleanSymbol.includes('BOOM');
      const isCrash = cleanSymbol.includes('CRASH');

      if (isBoom) {
        if (rsiVal <= 28.0) {
          item.score = 4.9;
          item.trend = "STRONG SPIKE ZONE";
          item.suggestion = `⚡ [${cleanSymbol} BUY SPIKE ACTIVE]: Oversold Zone! High Probability Buy Spike`;
        } else if (rsiVal <= 38.0) {
          item.score = 3.8;
          item.trend = "SPIKE SETUP BUILDING";
          item.suggestion = `⏳ [${cleanSymbol} WATCHLIST]: Approaching Spike Support Zone`;
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
          item.score = 3.8;
          item.trend = "DROP SETUP BUILDING";
          item.suggestion = `⏳ [${cleanSymbol} WATCHLIST]: Approaching Drop Resistance Zone`;
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
