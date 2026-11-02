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

  // BUY Pair: Price falls below min range limit -> Expired
  if (type.includes('BUY') && p < minP) return true;
  // SELL Pair: Price exceeds max range limit -> Expired
  if (type.includes('SELL') && p > maxP) return true;

  return false;
}

// GET API State Endpoint
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const now = Date.now();
  const pairsList = Object.values(allPairsData);

  // Active Signals: Score 5.0
  const activeSignals = pairsList.filter(
    p => parseFloat(p.score) === 5.0 && (now - p.lastUpdated) < 1800000
  );
  
  // Watchlist Signals: Score 4.5 - 4.9 & Active Range (Valid for 15 Mins / 900,000 ms)
  const watchlistSignals = pairsList.filter(
    p => parseFloat(p.score) >= 4.5 && parseFloat(p.score) <= 4.9 && (now - p.lastUpdated) < 900000
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

  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  const livePrice = parseFloat(item.price || item.livePrice || 0);
  const tradeType = item.type || item.tradeType || 'BUY';
  let newScore = parseFloat(item.score || 2.0);

  // Range for Watchlist Entry (Estimated 10-15 Min Zone)
  const minRange = item.minRange || (tradeType === 'BUY' ? (livePrice * 0.998).toFixed(2) : livePrice.toFixed(2));
  const maxRange = item.maxRange || (tradeType === 'BUY' ? livePrice.toFixed(2) : (livePrice * 1.002).toFixed(2));
  const stopLoss = item.stopLoss || item.sl || (tradeType === 'BUY' ? (livePrice * 0.996).toFixed(2) : (livePrice * 1.004).toFixed(2));

  // Invalidation / Expired Check
  if (isRangeExpired(livePrice, minRange, maxRange, tradeType)) {
    newScore = 2.0; // Force remove from Watchlist & Active
  }

  // Calculate Probability Percentage (for Watchlist Display)
  let spikeProbability = "75%";
  if (newScore === 5.0) spikeProbability = "95%";
  else if (newScore >= 4.8) spikeProbability = "88%";
  else if (newScore >= 4.5) spikeProbability = "80%";

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

  io.emit('market-update', allPairsData[cleanSymbol]);

  return res.status(200).json({ 
    success: true, 
    symbol: cleanSymbol, 
    score: newScore 
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Engine running on port ${PORT}`);
});
