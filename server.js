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

const allPairsData = {};

// 📊 State Endpoint (Returns pairs along with full SMC structure)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const pairsList = Object.values(allPairsData);
  
  return res.json({
    status: "online",
    activeSignalsCount: pairsList.length,
    activeSignals: pairsList.filter(p => parseFloat(p.score) >= 4.0),
    allPairs: allPairsData,
    markets: pairsList
  });
});

// 🚀 Receiver Endpoint
app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Normalize Symbol Names (e.g. BOOM600INDEX -> BOOM600)
  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  // Save full tick data including SMC breakdown
  allPairsData[cleanSymbol] = {
    ...item,
    time: Date.now()
  };

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
