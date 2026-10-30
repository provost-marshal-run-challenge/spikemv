const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Global In-Memory Storage for Latest Market State
const allPairsData = {};

// 📊 State / Feed Status Endpoint (Lovable UI & Dashboard Sync)
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.json({
    status: "online",
    activeSignalsCount: Object.keys(allPairsData).length,
    allPairs: allPairsData,
    markets: Object.values(allPairsData)
  });
});

// 🚀 MT5 Feed Receiver & Real-time Stream Processor
app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid market payload" });
  }

  const cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '');
  
  // Store latest feed tick in memory
  allPairsData[cleanSymbol] = item;

  // Socket.io Real-Time UI Broadcasts
  io.emit('market-update', item);
  io.emit('market_update', item);

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

// Catch-all route for Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SpikeMV Engine running on port ${PORT}`);
});
