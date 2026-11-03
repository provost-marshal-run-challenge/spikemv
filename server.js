const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const allPairsData = {};

/**
 * Price Zone Invalidation Check (Active Signal & Watchlist Range Check)
 */
function isRangeExpired(livePrice, minPrice, maxPrice, tradeType) {
  if (!livePrice || !minPrice || !maxPrice) return false;
  const p = parseFloat(livePrice);
  const minP = parseFloat(minPrice);
  const maxP = parseFloat(maxPrice);
  const type = String(tradeType || '').toUpperCase();

  // BUY Pair: Price drops below min range limit -> Expired / Out of Zone
  if (type.includes('BUY') && p < minP) return true;
  // SELL Pair: Price exceeds max range limit -> Expired / Out of Zone
  if (type.includes('SELL') && p > maxP) return true;

  return false;
}

// GET API State Endpoint
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const now = Date.now();
  const pairsList = Object.values(allPairsData);

  // Active Signals: Score 5.0 (Valid for 30 Mins / 1,800,000 ms)
  const activeSignals = pairsList.filter(
    p => Math.round(parseFloat(p.score) * 10) / 10 === 5.0 && (now - p.lastUpdated) < 1800000
  );
  
  // Watchlist Signals: Score 4.5 - 4.9 (Valid for 15 Mins / 900,000 ms)
  const watchlistSignals = pairsList.filter(
    p => {
      const s = Math.round(parseFloat(p.score) * 10) / 10;
      return s >= 4.5 && s <= 4.9 && (now - p.lastUpdated) < 900000;
    }
  );

  return res.json({
    status: "online",
    activeSignalsCount: activeSignals.length,
    watchlistSignalsCount: watchlistSignals.length,
    activeSignals: activeSignals,
    watchlist: watchlistSignals,
    allPairs: allPairsData,
    markets: pairsList
  });
});

// POST Endpoint for EA Updates
app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Clean symbol name (e.g. BOOM600INDEX -> BOOM600)
  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  const livePrice = parseFloat(item.price || item.livePrice || 0);
  const tradeType = item.type || item.tradeType || 'BUY';
  const existingRecord = allPairsData[cleanSymbol];

  // Clean Score Parsing (Prevents float precision bugs like 5.0000003)
  let rawScore = parseFloat(item.score || 2.0);
  let newScore = Math.round(rawScore * 10) / 10;

  // 💡 RANGE LOCK LOGIC: Lock minRange & maxRange for 15 mins
  let minRange = item.minRange;
  let maxRange = item.maxRange;

  if (existingRecord && existingRecord.score >= 4.5 && (Date.now() - existingRecord.lastUpdated < 900000)) {
    minRange = existingRecord.minRange || minRange;
    maxRange = existingRecord.maxRange || maxRange;
  }

  const stopLoss = item.stopLoss || item.sl || (tradeType === 'BUY' ? (livePrice * 0.996).toFixed(2) : (livePrice * 1.004).toFixed(2));

  // 💡 RANGE BREAKOUT CHECK: Break out of range -> Set score 1.0 (Auto-Remove)
  if (isRangeExpired(livePrice, minRange, maxRange, tradeType)) {
    newScore = 1.0; 
  }

  // Dynamic Spike Probability
  let spikeProbability = item.spikeProbability;
  if (newScore === 5.0) {
    spikeProbability = "95%";
  } else if (!spikeProbability) {
    if (newScore >= 4.8) spikeProbability = "88%";
    else if (newScore >= 4.5) spikeProbability = "78%";
    else spikeProbability = "60%";
  }

  // Record Update
  allPairsData[cleanSymbol] = {
    ...item,
    symbol: cleanSymbol,
    price: livePrice,
    score: newScore,
    minRange: minRange,
    maxRange: maxRange,
    stopLoss: stopLoss,
    spikeProbability: spikeProbability,
    tradeType: tradeType,
    lastUpdated: Date.now()
  };

  // Broadcast via Socket.io
  io.emit('market-update', allPairsData[cleanSymbol]);

  return res.status(200).json({ 
    success: true, 
    symbol: cleanSymbol, 
    score: newScore,
    minRange: minRange,
    maxRange: maxRange
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Engine running on port ${PORT}`);
});
