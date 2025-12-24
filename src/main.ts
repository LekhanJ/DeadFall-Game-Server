import { WebSocketServer, WebSocket } from "ws";
import { Player } from "./entities/player.ts";
import { Bullet } from "./entities/bullet.ts";

// ============================================================================
// Types & Constants
// ============================================================================

const TICK_RATE = 33; // ms
const PORT = 3000;
const MOVE_SPEED = 5; // units per second

interface GameState {
  players: Map<string, Player>;
  sockets: Map<string, WebSocket>;
  bullets: Map<string, Bullet>;
  playerInputs: Map<string, PlayerInput>;
}

interface PlayerInput {
  horizontal: number;
  vertical: number;
  lastUpdate: number;
}

// ============================================================================
// Game State
// ============================================================================

const gameState: GameState = {
  players: new Map(),
  sockets: new Map(),
  bullets: new Map(),
  playerInputs: new Map(),
};

// ============================================================================
// Message Handlers
// ============================================================================

class MessageHandler {
  private sessionId: string;
  private player: Player;
  private state: GameState;

  constructor(sessionId: string, player: Player, state: GameState) {
    this.sessionId = sessionId;
    this.player = player;
    this.state = state;
  }

  handleMovementInput(data: any) {
    // Store the input for processing in game loop
    this.state.playerInputs.set(this.sessionId, {
      horizontal: data.horizontal || 0,
      vertical: data.vertical || 0,
      lastUpdate: Date.now(),
    });
  }

  handleAim(data: any) {
    this.broadcastToOthers({
      type: "aim",
      sessionId: this.sessionId,
      direction: data.direction,
    });
  }

  handleShoot(data: any) {
    const bullet = new Bullet();
    bullet.name = "Bullet";
    bullet.activator = data.activator;
    bullet.position.x = data.position.x;
    bullet.position.y = data.position.y;
    bullet.direction.x = data.direction.x;
    bullet.direction.y = data.direction.y;

    this.state.bullets.set(bullet.id, bullet);

    this.broadcastToAll({
      type: "serverSpawn",
      name: bullet.name,
      sessionId: this.sessionId,
      id: bullet.id,
      activator: bullet.activator,
      position: bullet.position,
      direction: bullet.direction,
    });

    console.log("Bullet spawned from weapon:", data.weaponName || "Unknown");
  }

  handleInventorySwitch(data: any) {
    this.player.currentWeapon = data.weaponName || "";
    this.player.currentSlotIndex = data.slotIndex || 0;

    this.broadcastToOthers({
      type: "inventorySwitch",
      sessionId: this.sessionId,
      slotIndex: data.slotIndex,
      weaponName: data.weaponName,
    });
  }

  handleMeleeAttack(data: any) {
    const targetId = data.targetId;
    const damage = data.damage || 15;
    const targetPlayer = this.state.players.get(targetId);

    if (!targetPlayer || !targetPlayer.isAlive) return;

    const died = applyDamage(targetPlayer, damage);

    this.broadcastHealthUpdate(targetId, targetPlayer);

    if (died) {
      this.handlePlayerDeath(targetId, targetPlayer);
    }

    this.broadcastToAll({
      type: "meleeAttack",
      attackerId: this.sessionId,
      targetId: targetId,
      damage: damage,
    });
  }

  handleBulletCollision(data: any) {
    const bullet = this.state.bullets.get(data.id);
    if (bullet) {
      bullet.hasCollided = true;
    }
  }

  private handlePlayerDeath(targetId: string, targetPlayer: Player) {
    targetPlayer.health = 0;
    targetPlayer.isAlive = false;

    this.broadcastToAll({
      type: "playerKilled",
      sessionId: targetId,
    });
  }

  private broadcastHealthUpdate(targetId: string, targetPlayer: Player) {
    this.broadcastToAll({
      type: "healthUpdate",
      sessionId: targetId,
      health: targetPlayer.health,
      maxHealth: targetPlayer.maxHealth,
      shield: targetPlayer.shield,
      maxShield: targetPlayer.maxShield,
    });
  }

  private broadcastToOthers(message: any) {
    this.state.sockets.forEach((socket, id) => {
      if (id !== this.sessionId) {
        socket.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToAll(message: any) {
    this.state.sockets.forEach((socket) => {
      socket.send(JSON.stringify(message));
    });
  }
}

// ============================================================================
// Game Loop
// ============================================================================

function startGameLoop() {
  setInterval(() => {
    const deltaTime = TICK_RATE / 1000; // Convert to seconds

    // Update player positions based on inputs
    gameState.playerInputs.forEach((input, sessionId) => {
      const player = gameState.players.get(sessionId);
      if (!player || !player.isAlive) return;

      // Normalize input vector
      const inputMagnitude = Math.sqrt(
        input.horizontal * input.horizontal + input.vertical * input.vertical
      );

      let moveX = input.horizontal;
      let moveY = input.vertical;

      if (inputMagnitude > 0) {
        moveX /= inputMagnitude;
        moveY /= inputMagnitude;
      }

      // Update position
      player.position.x += moveX * MOVE_SPEED * deltaTime;
      player.position.y += moveY * MOVE_SPEED * deltaTime;

      // Broadcast position to all clients
      broadcastToAll({
        type: "serverPositionUpdate",
        sessionId: sessionId,
        position: {
          x: player.position.x,
          y: player.position.y,
        },
      });
    });

    // Update bullets
    const bulletsToRemove: string[] = [];

    gameState.bullets.forEach((bullet, bulletId) => {
      // 1. Move bullet
      const expired = bullet.onUpdate(TICK_RATE);

      // 2. Check collision
      const hitPlayer = checkBulletHits(bullet, gameState);

      if (hitPlayer) {
        const DAMAGE = 25;
        const died = applyDamage(hitPlayer, DAMAGE);

        broadcastToAll({
          type: "healthUpdate",
          sessionId: hitPlayer.sessionId,
          health: hitPlayer.health,
          shield: hitPlayer.shield,
          maxHealth: hitPlayer.maxHealth,
          maxShield: hitPlayer.maxShield,
        });

        if (died) {
          broadcastToAll({
            type: "playerKilled",
            sessionId: hitPlayer.sessionId,
          });
        }

        bulletsToRemove.push(bulletId);
        return;
      }

      if (expired) {
        bulletsToRemove.push(bulletId);
        return;
      }

      // 3. Send movement update (can be optimized later)
      broadcastToAll({
        type: "bulletMove",
        id: bulletId,
        position: {
          x: bullet.position.x,
          y: bullet.position.y,
        },
      });
    });

    // 4. Remove bullets AFTER iteration
    for (const id of bulletsToRemove) {
      gameState.bullets.delete(id);
      broadcastToAll({
        type: "serverUnspawn",
        id,
      });
    }
  }, TICK_RATE);
}

function checkBulletHits(bullet: Bullet, state: GameState) {
  for (const [playerId, player] of state.players) {
    if (!player.isAlive) continue;
    if (player.sessionId === bullet.activator) continue;

    const dx = player.position.x - bullet.position.x;
    const dy = player.position.y - bullet.position.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    const HIT_RADIUS = 0.5; // tweak as needed

    if (distance <= HIT_RADIUS) {
      return player;
    }
  }
  return null;
}

function applyDamage(player: Player, damage: number) {
  if (!player.isAlive) return false;

  let remainingDamage = damage;

  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, remainingDamage);
    player.shield -= absorbed;
    remainingDamage -= absorbed;
  }

  if (remainingDamage > 0) {
    player.health -= remainingDamage;
  }

  if (player.health <= 0) {
    player.health = 0;
    player.isAlive = false;
    return true;
  }

  return false;
}

// ============================================================================
// Connection Handling
// ============================================================================

function handleNewConnection(ws: WebSocket) {
  console.log("Client connected.");

  const sessionId = crypto.randomUUID();
  const player = new Player(sessionId);

  gameState.players.set(sessionId, player);
  gameState.sockets.set(sessionId, ws);
  gameState.playerInputs.set(sessionId, {
    horizontal: 0,
    vertical: 0,
    lastUpdate: Date.now(),
  });

  console.log("Player joined with id:", sessionId);

  sendInitialState(ws, sessionId, player);
  notifyPlayersOfNewJoin(sessionId, player);

  const messageHandler = new MessageHandler(sessionId, player, gameState);

  ws.on("message", (message: string) => {
    handleMessage(message, messageHandler);
  });

  ws.on("close", () => {
    handleDisconnection(sessionId);
  });
}

function sendInitialState(ws: WebSocket, sessionId: string, player: Player) {
  ws.send(
    JSON.stringify({
      type: "initialState",
      sessionId: sessionId,
      self: player,
      others: Array.from(gameState.players.values()).filter(
        (p) => p.sessionId !== sessionId
      ),
    })
  );
}

function notifyPlayersOfNewJoin(sessionId: string, player: Player) {
  gameState.sockets.forEach((socket, id) => {
    if (id !== sessionId) {
      socket.send(
        JSON.stringify({
          type: "spawn",
          player: player,
        })
      );
    }
  });
}

function handleMessage(message: string, handler: MessageHandler) {
  try {
    const data = JSON.parse(message);

    switch (data.type) {
      case "moveInput":
        handler.handleMovementInput(data);
        break;
      case "aim":
        handler.handleAim(data);
        break;
      case "shoot":
        handler.handleShoot(data);
        break;
      case "inventorySwitch":
        handler.handleInventorySwitch(data);
        break;
      case "meleeAttack":
        handler.handleMeleeAttack(data);
        break;
      case "bulletCollide":
        handler.handleBulletCollision(data);
        break;
      default:
        console.warn("Unknown message type:", data.type);
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
}

function handleDisconnection(sessionId: string) {
  console.log("Player disconnected:", sessionId);

  gameState.players.delete(sessionId);
  gameState.sockets.delete(sessionId);
  gameState.playerInputs.delete(sessionId);

  broadcastToAll({
    type: "player_left",
    sessionId: sessionId,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

function broadcastToAll(message: any) {
  gameState.sockets.forEach((socket) => {
    socket.send(JSON.stringify(message));
  });
}

// ============================================================================
// Server Initialization
// ============================================================================

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", handleNewConnection);

startGameLoop();

console.log(`Server running on ws://localhost:${PORT}`);
