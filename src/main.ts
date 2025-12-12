import { WebSocketServer, WebSocket } from "ws";
import { Player } from "./entities/player.ts";
import { Vector2 } from "./utils/vector2.ts";

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
      for (let [id, socket] of sockets) {
        socket.send(
          JSON.stringify({
            type: "shoot",
            sessionId: thisPlayerSessionId,
            position: data.position,
            direction: data.direction,
          })
        );
      }
      checkHitDetection(data, player, thisPlayerSessionId);
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

function checkHitDetection(data, player: Player, shooterId: string) {
  const shooter = player;
  const dir = new Vector2(data.direction.x, data.direction.y).normalize();
  const maxRange = 10; 
  const hitRadius = 0.5;
  let closestTarget: Player | null = null;
  let closestDist = maxRange;

  for (let [id, other] of players) {
    if (id === shooterId) continue;
    if (!other.isAlive) continue;

    const hitInfo = rayHitPlayer(
      shooter.position,
      dir,
      other.position,
      hitRadius,
      maxRange
    );

    if (hitInfo && hitInfo.distance < closestDist) {
      closestDist = hitInfo.distance;
      closestTarget = other;
    }
  }

  if (closestTarget) {
    console.log("Got Hit");
    
    const damage = 25;
    closestTarget.health -= damage;
    if (closestTarget.health <= 0) {
      closestTarget.health = 0;
      closestTarget.isAlive = false;
      console.log("Player Died");
      
      for (let [, socket] of sockets) {
        socket.send(
          JSON.stringify({
            type: "playerKilled",
            sessionId: closestTarget.sessionId,
          })
        );
      }
    }

    for (let [, socket] of sockets) {
      socket.send(
        JSON.stringify({
          type: "healthUpdate",
          sessionId: closestTarget.sessionId,
          health: closestTarget.health,
          maxHealth: closestTarget.maxHealth,
        })
      );
    }
  }
}

function rayHitPlayer( origin: Vector2, dir: Vector2, target: Vector2, radius: number,maxRange: number): { distance: number } | null {
  const toTarget = new Vector2(
    target.x - origin.x,
    target.y - origin.y
  );

  const proj = toTarget.x * dir.x + toTarget.y * dir.y;

  if (proj < 0 || proj > maxRange) {
    return null;
  }

  const closest = new Vector2(
    origin.x + dir.x * proj,
    origin.y + dir.y * proj
  );

  const dx = target.x - closest.x;
  const dy = target.y - closest.y;
  const distToLine = Math.sqrt(dx * dx + dy * dy);

  if (distToLine <= radius) {
    return { distance: proj };
  }

  return null;
}