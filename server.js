const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/update', (req, res) => {
    const data = req.body;
    console.log("✅ WebRequest Received from MT5:", data.symbol, data.suggestion);
    io.emit('market_update', data);
    res.status(200).json({ status: "success", message: "Data broadcasted" });
});

app.get('/health', (req, res) => {
    res.status(200).send("SpikeMV Backend Active");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SpikeMV Server running on port ${PORT}`);
});
