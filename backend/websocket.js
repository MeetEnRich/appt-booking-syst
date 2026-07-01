const WebSocket = require('ws');
const url = require('url');

let wss = null;
// Maps userId -> Set of connected WebSocket client instances
const userConnections = new Map();

function initWebSocket(server) {
  wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let authenticatedUserId = null;

    ws.on('message', (messageStr) => {
      try {
        const msg = JSON.parse(messageStr);
        if (msg.type === 'auth' && msg.userId) {
          authenticatedUserId = Number(msg.userId);
          if (!userConnections.has(authenticatedUserId)) {
            userConnections.set(authenticatedUserId, new Set());
          }
          userConnections.get(authenticatedUserId).add(ws);
          ws.send(JSON.stringify({ type: 'auth_success', message: 'WebSocket session established.' }));
        }
      } catch (err) {
        console.error('WS Message parsing error:', err);
      }
    });

    ws.on('close', () => {
      if (authenticatedUserId && userConnections.has(authenticatedUserId)) {
        const conns = userConnections.get(authenticatedUserId);
        conns.delete(ws);
        if (conns.size === 0) {
          userConnections.delete(authenticatedUserId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WS connection error:', err);
    });
  });

  console.log('WebSocket Server handler mounted on /ws path.');
}

// Push notification helper to send alerts to a specific user
function sendRealTimeAlert(userId, messageData) {
  if (!wss || !userId) return;

  const conns = userConnections.get(Number(userId));
  if (conns && conns.size > 0) {
    const dataStr = JSON.stringify(messageData);
    conns.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(dataStr);
      }
    });
  }
}

module.exports = {
  initWebSocket,
  sendRealTimeAlert
};
