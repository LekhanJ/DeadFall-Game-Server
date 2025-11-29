import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws: WebSocket) => {
  console.log("Connected");

  ws.on("message", (msg: string) => {
    const data = JSON.parse(msg);

    let { x, y, inputs } = data;
    let dx = 0;
    let dy = 0;
    const speed = 5;

    if (inputs.includes("up")) dy -= 1;
    if (inputs.includes("down")) dy += 1;
    if (inputs.includes("left")) dx -= 1;
    if (inputs.includes("right")) dx += 1;

    const len = Math.hypot(dx, dy);

    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    x += dx * speed;
    y += dy * speed;

    ws.send(JSON.stringify({ x, y }));
  });
});
