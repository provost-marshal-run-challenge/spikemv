const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' }));

// Accept raw text/json from MT5 WebRequest to bypass 403 header block
app.use(express.text({ type: '*/*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  if (type.includes('BUY') && p < minP) return true;
  if (type.includes('SELL') && p > maxP) return true;

  return false;
}

// POST Wildcard Catch-all Endpoint (Guaranteed to capture MT5 WebRequest and return 200 OK)
app.post('*', (req, res) => {
  try {
    let data = req.body;
    
    // If body came as raw text/string from MT5, parse it to JSON safely
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        // Fallback if raw text
      }
    }

    console.log("📥 [Feed Received via POST]:", data);

    if (data && data.symbol) {
      const symbol = String(data.symbol).toUpperCase().replace(/\s+/g, '');
      data.lastUpdated = Date.now();

      if (isRangeExpired(data.price, data.minRange, data.maxRange, data.type)) {
        data.score = 1.0;
        data.trend = "SETUP INVALIDATED";
        data.spikeProbability = "0%";
        data.suggestion = `❌ [${symbol} EXPIRED]: Out of expected locked range.`;
      }

      allPairsData[symbol] = data;
      io.emit('live-feed-update', allPairsData);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify({ status: 'success', message: 'Feed received successfully' }));
  } catch (err) {
    console.error("⚠️ Error handling post request:", err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify({ status: 'success', note: 'handled with fallback' }));
  }
});

// GET API State Endpoint
app.get('/api/state', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const pairsList = Object.values(allPairsData);
  res.status(200).json({
    status: 'online',
    engine: 'SpikeMV Institutional Terminal Active',
    totalPairs: pairsList.length,
    data: allPairsData
  });
});

// Socket.io Connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.emit('live-feed-update', allPairsData);

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SpikeMV Institutional Engine running on port ${PORT}`);
});
