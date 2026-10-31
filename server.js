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

// GET API State Endpoint
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const now = Date.now();
  const pairsList = Object.values(allPairsData);

  // Filter Active Signals (Exact Score 5.0) & Watchlist (Score 4.0 - 4.9)
  // Remove signals older than 30 minutes (1800000 ms) automatically
  const activeSignals = pairsList.filter(p => parseFloat(p.score) === 5.0 && (now - p.lastUpdated) < 1800000);
  const watchlistSignals = pairsList.filter(p => parseFloat(p.score) >= 4.0 && parseFloat(p.score) < 5.0 && (now - p.lastUpdated) < 1800000);

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

  // Clean symbol name (e.g., BOOM600INDEX -> BOOM600, GAINX1200)
  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  // Preserve initial signal post timestamp across page refreshes
  const existingRecord = allPairsData[cleanSymbol];
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const firstPostedTime = existingRecord?.firstPostedTime || item.postedTime || nowTime;

  // Flatten & map matrix payload
  const matrixArray = item.matrix || [
    item.tfM1 || 'BUY',
    item.tfM5 || 'BUY',
    item.tfM15 || 'BUY',
    item.tfM30 || 'BUY',
    item.tfH1 || 'BUY',
    item.tfH4 || 'BUY',
    item.tfD1 || 'BUY',
    item.tfW1 || 'BUY'
  ];

  // Map SMC structure
  const smcObject = item.smc || {
    fibonacci: item.fibLevel || '50.0% Equilibrium Zone',
    orderBlock: item.orderBlock || 'Active Zone',
    liquiditySweep: item.liquiditySweep || 'Building Liquidity',
    supportResistance: item.supRes || 'In Range',
    resistance: item.resistance || 'High Level',
    candlestick: item.candlePattern || 'Consolidation',
    trendlines: item.trendline || 'Channel Active',
    squeeze: item.channel || 'Compression'
  };

  // Construct updated record with Stop Loss Range & Post Time
  allPairsData[cleanSymbol] = {
    ...item,
    symbol: cleanSymbol,
    stopLoss: item.stopLoss || item.sl || (item.price * 0.995).toFixed(2),
    firstPostedTime: firstPostedTime,
    matrix: matrixArray,
    smc: smcObject,
    lastUpdated: Date.now()
  };

  // Broadcast to Socket.io clients
  io.emit('market-update', allPairsData[cleanSymbol]);
  io.emit('market_update', allPairsData[cleanSymbol]);

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Engine running on port ${PORT}`);
});
