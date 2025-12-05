import { WebSocketServer, WebSocket } from "ws";
import { Player } from "./entities/player.ts";

const wss = new WebSocketServer({ port: 3000 });

const players = new Map<string, Player>();
const sockets = new Map<string, WebSocket>();

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected.");

  const thisPlayerSessionId = crypto.randomUUID();
  const player = new Player(thisPlayerSessionId);
  players.set(thisPlayerSessionId, player);
  sockets.set(thisPlayerSessionId, ws);

  console.log("Player joined with id:", thisPlayerSessionId);

  ws.send(JSON.stringify({
    type: "initialState",
    sessionId: thisPlayerSessionId,
    self: player,
    others: Array.from(players.values()).filter(p => p.sessionId !== thisPlayerSessionId),
  }));
  
  for (let [id, socket] of sockets) {
    if (id !== thisPlayerSessionId) {
      socket.send(JSON.stringify({
        type: "spawn",
        player: player,
      }));
    }
  }

  ws.on("message", (msg: string) => {

  });

  ws.on("close", () => {
    console.log("Player disconnected:", thisPlayerSessionId);
    players.delete(thisPlayerSessionId);
    sockets.delete(thisPlayerSessionId);
  });
});
