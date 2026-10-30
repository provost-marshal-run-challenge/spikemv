const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
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

// Global Storage with initial Pairs data so polling is never empty
const allPairsData = {
  "GAINX1200": { symbol: "GAINX1200", score: 4.5, price: 1200.0, rsi: 55.0, trend: "STRONG BUY", suggestion: "BUY SPIKE ACTIVE" },
  "PAINX1200": { symbol: "PAINX1200", score: 4.2, price: 1200.0, rsi: 45.0, trend: "SETUP", suggestion: "SELL DROP ACTIVE" },
  "BOOM600": { symbol: "BOOM600", score: 4.6, price: 600.0, rsi: 62.0, trend: "STRONG BUY", suggestion: "BUY SPIKE ACTIVE" },
  "CRASH1000": { symbol: "CRASH1000", score: 3.8, price: 1000.0, rsi: 48.0, trend: "MONITORING", suggestion: "WAIT FOR SETUP" }
};

// 📊 State Endpoint (Guaranteed payload for Lovable Dashboard)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const pairsList = Object.values(allPairsData);
  const activeSignals = pairsList.filter(p => parseFloat(p.score) >= 4.0);

  return res.json({
    status: "online",
    activeSignalsCount: activeSignals.length,
    activeSignals: activeSignals,
    allPairs: allPairsData,
    markets: pairsList
  });
});

// 🚀 Receiver Endpoint
app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid market payload" });
  }

  // Symbol Name Clean-up (BOOM600INDEX -> BOOM600)
  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  allPairsData[cleanSymbol] = item;

  io.emit('market-update', item);
  io.emit('market_update', item);

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Engine running on port ${PORT}`);
});
