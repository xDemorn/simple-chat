// Re-export the Durable Object class so the runtime can find it
export { ChatRoom } from './chat-room.js';

export default {
  async fetch(request, env) {
    // Upgrade WebSocket connections → route to the single shared ChatRoom DO
    if (request.headers.get('Upgrade') === 'websocket') {
      const id = env.CHAT_ROOM.idFromName('main');
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    // Everything else → serve from the /public static assets
    return env.ASSETS.fetch(request);
  },
};
