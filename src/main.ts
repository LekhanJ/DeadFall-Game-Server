import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3000 });

let player = {
  x: 300,
  y: 300,
  inputs: [],
  speed: 5
};

wss.on("connection", (ws: WebSocket) => {
  console.log("Connected");

  ws.on("message", (msg: string) => {
    const data = JSON.parse(msg);
    player.inputs = data.inputs;
  });

  const TICK_RATE = 30;
  const interval = setInterval(() => gameTick(ws), 1000 / TICK_RATE);

  ws.on("close", () => {
    clearInterval(interval);
  });
});

function gameTick(ws: WebSocket) {
  let dx = 0, dy = 0;

  if (player.inputs.includes("up")) dy -= 1;
  if (player.inputs.includes("down")) dy += 1;
  if (player.inputs.includes("left")) dx -= 1;
  if (player.inputs.includes("right")) dx += 1;

  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  player.x += dx * player.speed;
  player.y += dy * player.speed;

  ws.send(JSON.stringify({ x: player.x, y: player.y }));
}
