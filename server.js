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

app.post('/api/update-feed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const item = req.body;

  if (!item || !item.symbol) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  let cleanSymbol = String(item.symbol).toUpperCase().replace(/\s+/g, '').replace('INDEX', '');
  item.symbol = cleanSymbol;

  // Flatten & map matrix payload if sent individually or as array
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

  allPairsData[cleanSymbol] = {
    ...item,
    matrix: matrixArray,
    smc: smcObject,
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
  console.log(`🚀 SpikeMV Engine running on port ${PORT}`);
});
