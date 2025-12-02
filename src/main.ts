import { WebSocketServer, WebSocket } from "ws";
import { Player } from "./entities/player.ts";

const wss = new WebSocketServer({ port: 3000 });

const players = new Map<string, Player>();

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected.");

  const sessionId = crypto.randomUUID();
  const player = new Player(sessionId, ws);
  players.set(sessionId, player);

  console.log("Player joined with id:", sessionId);

  ws.send(JSON.stringify({
    type: "connected",
    sessionId: sessionId,
  }));

  if (players.size === 2) {
    starGame();
  }
  
  ws.on("message", (msg: string) => {
    const data = JSON.parse(msg);

    switch (data.type) {
      case "playerMove":
        player.inputs = data.inputs;
        break;

      default:
        console.warn("Unknown message type:", data.type);
        break;
    }
  });

  ws.on("close", () => {
    console.log("Player disconnected:", sessionId);
    players.delete(sessionId);
  });
});

const TICK_RATE = 60;
setInterval(gameTick, 1000 / TICK_RATE);

function gameTick() {
  for (const player of players.values()) {
    simulateMovement(player);
  }

  broadcastState();
}

function simulateMovement(player: Player) {
  let dx = 0,
    dy = 0;

  const [up, down, left, right] = player.inputs;

  if (up) dy -= 1;
  if (down) dy += 1;
  if (left) dx -= 1;
  if (right) dx += 1;

  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  player.x += dx * player.speed;
  player.y += dy * player.speed;
}

function starGame() {
  const snapshot: Record<string, any> = {};

  for (const [id, player] of players) {
    snapshot[id] = {
      x: player.x,
      y: player.y,
    };
  }

  const payload = JSON.stringify({
    type: "startGame",
    players: snapshot,
  });
  

  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}

function broadcastState() {
  const snapshot: Record<string, any> = {};

  for (const [id, player] of players) {
    snapshot[id] = {
      x: player.x,
      y: player.y,
    };
  }

  const payload = JSON.stringify({
    type: "playerMove",
    players: snapshot,
  });
  

  for (const player of players.values()) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}