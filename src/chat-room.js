/**
 * ChatRoom — Durable Object
 *
 * A single global instance of this class handles ALL connected WebSocket
 * clients. It uses the Hibernation API so the DO can be evicted from memory
 * between messages without losing connection state.
 *
 * Per-socket metadata (username) is stored via ws.serializeAttachment() so it
 * survives hibernation/wake cycles. All active sockets are retrieved with
 * this.state.getWebSockets().
 */
export class ChatRoom {
  constructor(state) {
    this.state = state;
  }

  // ── Incoming HTTP → WebSocket upgrade ──────────────────────────────────────
  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hand the server-side socket to the DO runtime (enables hibernation)
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket event handlers ───────────────────────────────────────────────
  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'join': {
        const username = (msg.username || 'Anonymous').trim().slice(0, 24);
        // Attach username to this socket (persists across hibernation)
        ws.serializeAttachment({ username });
        this.broadcast({ type: 'system', text: `${username} joined the chat` });
        this.broadcastUsers();
        break;
      }

      case 'message': {
        const session = ws.deserializeAttachment();
        if (!session?.username) return;
        const text = (msg.text || '').trim();
        if (!text) return;
        this.broadcast({
          type: 'message',
          username: session.username,
          text,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  }

  async webSocketClose(ws) {
    const session = ws.deserializeAttachment();
    if (session?.username) {
      this.broadcast({ type: 'system', text: `${session.username} left the chat` });
    }
    this.broadcastUsers();
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(payload); } catch { /* ignore closed sockets */ }
    }
  }

  broadcastUsers() {
    const users = this.state
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment()?.username)
      .filter(Boolean);
    const payload = JSON.stringify({ type: 'users', users });
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(payload); } catch {}
    }
  }
}
