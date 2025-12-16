import { WebSocketServer, WebSocket } from "ws";
import { Player } from "./entities/player.ts";
import { Vector2 } from "./utils/vector2.ts";
import { Bullet } from "./entities/bullet.ts";

const wss = new WebSocketServer({ port: 3000 });

const players = new Map<string, Player>();
const sockets = new Map<string, WebSocket>();
const bullets = new Map<string, Bullet>();

setInterval(() => {
  bullets.forEach((bullet) => {
    let destroy = bullet.onUpdate(33);

    if (destroy) {
      bullets.delete(bullet.id);

      sockets.forEach((socket) => {
        socket.send(
          JSON.stringify({
            type: "serverUnspawn",
            id: bullet.id,
          })
        );
      });
    } else {
      sockets.forEach((socket) => {
        socket.send(
          JSON.stringify({
            type: "bulletMove",
            id: bullet.id,
            position: {
              x: bullet.position.x,
              y: bullet.position.y,
            },
          })
        );
      });
    }
  });
}, 33);

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected.");

  const thisPlayerSessionId = crypto.randomUUID();
  const player = new Player(thisPlayerSessionId);
  players.set(thisPlayerSessionId, player);
  sockets.set(thisPlayerSessionId, ws);

  console.log("Player joined with id:", thisPlayerSessionId);

  ws.send(
    JSON.stringify({
      type: "initialState",
      sessionId: thisPlayerSessionId,
      self: player,
      others: Array.from(players.values()).filter(
        (p) => p.sessionId !== thisPlayerSessionId
      ),
    })
  );

  for (let [id, socket] of sockets) {
    if (id !== thisPlayerSessionId) {
      socket.send(
        JSON.stringify({
          type: "spawn",
          player: player,
        })
      );
    }
  }

  ws.on("message", (message: string) => {
    const data = JSON.parse(message);

    if (data.type === "updatePosition") {
      player.position.x = data.position.x;
      player.position.y = data.position.y;

      for (let [id, socket] of sockets) {
        if (id !== thisPlayerSessionId) {
          socket.send(
            JSON.stringify({
              type: "updatePosition",
              sessionId: thisPlayerSessionId,
              position: player.position,
            })
          );
        }
      }
    }

    if (data.type === "aim") {
      for (let [id, socket] of sockets) {
        if (id !== thisPlayerSessionId) {
          socket.send(
            JSON.stringify({
              type: "aim",
              sessionId: thisPlayerSessionId,
              direction: data.direction,
            })
          );
        }
      }
    }

    if (data.type === "shoot") {
      const bullet = new Bullet();
      console.log("Bullet spawn");
      
      bullet.name = "Bullet";
      bullet.position.x = data.position.x;
      bullet.position.y = data.position.y;
      bullet.direction.x = data.direction.x;
      bullet.direction.y = data.direction.y;

      bullets.set(bullet.id, bullet);

      sockets.forEach((socket) => {
        socket.send(
          JSON.stringify({
            type: "serverSpawn",
            name: bullet.name,
            sessionId: thisPlayerSessionId, 
            id: bullet.id, 
            position: bullet.position,
            direction: bullet.direction,
          })
        );
      });
    }
  });

  ws.on("close", () => {
    console.log("Player disconnected:", thisPlayerSessionId);
    players.delete(thisPlayerSessionId);
    sockets.delete(thisPlayerSessionId);

    for (let socket of sockets.values()) {
      socket.send(
        JSON.stringify({
          type: "player_left",
          sessionId: thisPlayerSessionId,
        })
      );
    }
  });
});

function interval(func, wait, times) {
  var interv = (function (w, t) {
    return function () {
      if (typeof t === "undefined" || t-- > 0) {
        setTimeout(interv, w);
        try {
          func.call(null);
        } catch (e) {
          t = 0;
          throw e.toString();
        }
      }
    };
  })(wait, times);

  setTimeout(interv, wait);
}
