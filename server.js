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

// Pre-populated memory storage so Live Feed is NEVER lost on server restarts
const allPairsData = {
  "GAINX1200": { 
    symbol: "GAINX1200", 
    score: 4.5, 
    price: 1200.0, 
    rsi: 55.0, 
    trend: "BUY SPIKE ACTIVE", 
    suggestion: "BUY SPIKE ACTIVE",
    matrix: ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"],
    smc: {
      fibonacci: "0.618 Golden Zone",
      orderBlock: "Bullish Order Block Active",
      liquiditySweep: "Sell-Side Liquidity Swept",
      supportResistance: "At Strong Support",
      resistance: "Open path to Resistance",
      candlestick: "Bullish Engulfing",
      trendlines: "Ascending Channel",
      squeeze: "Squeeze Confirmed"
    }
  },
  "PAINX1200": { 
    symbol: "PAINX1200", 
    score: 4.2, 
    price: 1200.0, 
    rsi: 45.0, 
    trend: "SELL DROP ACTIVE", 
    suggestion: "SELL DROP ACTIVE",
    matrix: ["M1", "M5", "M15", "M30"],
    smc: {
      fibonacci: "0.786 Retracements",
      orderBlock: "Bearish Order Block",
      liquiditySweep: "Buy-Side Swept",
      supportResistance: "At Resistance Level",
      resistance: "Major Resistance Pool",
      candlestick: "Bearish Pinbar",
      trendlines: "Descending Trendline",
      squeeze: "Channel Breakout"
    }
  },
  "BOOM600": { 
    symbol: "BOOM600", 
    score: 4.6, 
    price: 600.0, 
    rsi: 62.0, 
    trend: "BUY SPIKE ACTIVE", 
    suggestion: "BUY SPIKE ACTIVE",
    matrix: ["M1", "M5", "M15", "M30", "H1"],
    smc: {
      fibonacci: "0.618 OTE Zone",
      orderBlock: "Spike Block Ready",
      liquiditySweep: "Liquidity Swept",
      supportResistance: "Support Pool",
      resistance: "Next Target 610",
      candlestick: "Spike Pattern",
      trendlines: "Uptrend Channel",
      squeeze: "High Compression"
    }
  }
};

// 📊 State Endpoint
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

// 🚀 Feed Receiver Endpoint
app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid market payload" });
  }

  // Symbol Name Clean-up (BOOM600INDEX -> BOOM600)
  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  // Merge & Save fresh tick data with SMC breakdown
  allPairsData[cleanSymbol] = {
    ...allPairsData[cleanSymbol],
    ...item,
    time: Date.now()
  };

  io.emit('market-update', allPairsData[cleanSymbol]);
  io.emit('market_update', allPairsData[cleanSymbol]);

  return res.status(200).json({ success: true, symbol: cleanSymbol });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Engine running on port ${PORT}`);
});
