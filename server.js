const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store latest market data for all Weltrade GainX & PainX symbols
let marketStore = {};

// MT5 WebRequest API Endpoint
app.post('/api/update', (req, res) => {
    const data = req.body;
    if (data && data.symbol) {
        // Save data for the specific Weltrade symbol
        marketStore[data.symbol] = data;
        console.log(`✅ WebRequest Received from Weltrade MT5: ${data.symbol} | Trend: ${data.trend}`);
        
        // Broadcast updated state to Web Dashboard
        io.emit('market_update', {
            latest: data,
            allPairs: marketStore
        });
    }
    res.status(200).json({ status: "success", message: "Weltrade data broadcasted" });
});

// Health Check route for cron-job.org auto-ping
app.get('/health', (req, res) => {
    res.status(200).send("SpikeMV Backend Active");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpikeMV Weltrade Analytics Server running on port ${PORT}`);
});
