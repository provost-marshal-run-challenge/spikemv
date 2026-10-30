const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const allPairsData = {};

// 📊 State Endpoint (Returns data matching Lovable structure)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.json({
    status: "online",
    activeSignalsCount: Object.keys(allPairsData).length,
    allPairs: allPairsData,
    markets: Object.values(allPairsData)
  });
});

// 🚀 Receiver Endpoint
app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid market payload" });
  }

  // Normalize Symbol Names (e.g. BOOM600INDEX -> BOOM600)
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
