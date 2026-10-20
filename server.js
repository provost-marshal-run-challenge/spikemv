const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store latest market data for all Weltrade symbols (Key stored in UPPERCASE)
let marketStore = {};

// Socket connection event
io.on('connection', (socket) => {
    console.log('⚡ New Client Connected to Dashboard');
    // Send currently stored data immediately upon connection
    socket.emit('market_update', { allPairs: marketStore });
});

// MT5 WebRequest API Endpoint
app.post('/api/update', (req, res) => {
    const data = req.body;
    if (data && data.symbol) {
        const cleanSymbol = data.symbol.toUpperCase().trim();
        marketStore[cleanSymbol] = {
            ...data,
            symbol: cleanSymbol,
            updatedAt: new Date().getTime()
        };
        
        console.log(`✅ MT5 WebRequest Received: ${cleanSymbol} | Price: ${data.price}`);
        
        // Broadcast all stored pairs to all connected dashboards
        io.emit('market_update', {
            latest: marketStore[cleanSymbol],
            allPairs: marketStore
        });
    }
    res.status(200).json({ status: "success", message: "Data broadcasted successfully" });
});

// Endpoint to fetch current memory store manually
app.get('/api/state', (req, res) => {
    res.status(200).json(marketStore);
});

// Health Check route for cron-job.org
app.get('/health', (req, res) => {
    res.status(200).send("SpikeMV Backend Active");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpikeMV Weltrade Analytics Server running on port ${PORT}`);
});
