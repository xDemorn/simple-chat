const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Track connected clients: ws -> { username }
const clients = new Map();

function broadcast(data, exclude = null) {
  const payload = JSON.stringify(data);
  for (const [client] of clients) {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const username = (msg.username || 'Anonymous').trim().slice(0, 24);
        clients.set(ws, { username });

        // Notify everyone of the new user
        broadcast({ type: 'system', text: `${username} joined the chat` });

        // Send current user list to all clients
        const users = [...clients.values()].map((c) => c.username);
        broadcast({ type: 'users', users });
        break;
      }

      case 'message': {
        const client = clients.get(ws);
        if (!client) return;
        const text = (msg.text || '').trim();
        if (!text) return;

        broadcast({
          type: 'message',
          username: client.username,
          text,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      clients.delete(ws);
      broadcast({ type: 'system', text: `${client.username} left the chat` });
      const users = [...clients.values()].map((c) => c.username);
      broadcast({ type: 'users', users });
    }
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
});
