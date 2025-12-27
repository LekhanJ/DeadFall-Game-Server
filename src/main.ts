import { WebSocketServer, WebSocket } from "ws";
import { Player } from "./entities/player.ts";
import { Bullet } from "./entities/bullet.ts";
import { Grenade } from "./entities/grenade.ts";
import { Inventory, ItemTemplates, ItemType } from "./gameplay/inventory.ts";

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
  grenades: Map<string, Grenade>;
  playerInputs: Map<string, PlayerInput>;
  inventories: Map<string, Inventory>;
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
  grenades: new Map(),
  playerInputs: new Map(),
  inventories: new Map(),
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
    const inventory = this.state.inventories.get(this.sessionId);
    if (!inventory) return;

    const currentItem = inventory.getCurrentItem();
    if (!currentItem || currentItem.itemType !== ItemType.Weapon) return;

    const bullet = new Bullet();
    bullet.name = "Bullet";
    bullet.activator = this.sessionId;
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

    console.log(
      "Bullet spawned from weapon:",
      currentItem.weaponName || "Unknown"
    );
  }

  handleInventorySwitch(data: any) {
    const slotIndex = data.slotIndex;
    const inventory = this.state.inventories.get(this.sessionId);

    if (!inventory) return;

    const success = inventory.switchToSlot(slotIndex);

    if (success) {
      const currentItem = inventory.getCurrentItem();

      // Update player's current weapon
      this.player.currentSlotIndex = slotIndex;
      this.player.currentWeapon = currentItem?.weaponName || "";

      // Broadcast to all players
      this.broadcastToAll({
        type: "inventoryUpdate",
        sessionId: this.sessionId,
        slotIndex: slotIndex,
        item: currentItem,
      });

      console.log(
        `Player ${this.sessionId} switched to slot ${slotIndex}: ${currentItem?.itemName}`
      );
    }
  }

  handleUseItem(data: any) {
    const inventory = this.state.inventories.get(this.sessionId);
    if (!inventory) return;

    const slotIndex = data.slotIndex || inventory.currentSlotIndex;
    const item = inventory.getItemAt(slotIndex);
    if (!item) return;

    if (
      item.itemType === ItemType.Health &&
      this.player.health >= this.player.maxHealth
    ) {
      return;
    }

    if (
      item.itemType === ItemType.Shield &&
      this.player.shield >= this.player.maxShield
    ) {
      return;
    }

    const consumed = inventory.useConsumable(slotIndex);
    if (!consumed) return;

    if (item.itemType === ItemType.Health) {
      const healAmount = 50;
      this.player.health = Math.min(
        this.player.health + healAmount,
        this.player.maxHealth
      );
    }

    if (item.itemType === ItemType.Shield) {
      const shieldAmount = 50;
      this.player.shield = Math.min(
        this.player.shield + shieldAmount,
        this.player.maxShield
      );
    }

    this.broadcastHealthUpdate(this.sessionId, this.player);
    this.sendInventoryUpdate();
  }

  handleThrowGrenade(data: any) {
    const inventory = this.state.inventories.get(this.sessionId);
    if (!inventory) return;

    const currentItem = inventory.getCurrentItem();

    if (
      currentItem &&
      currentItem.itemType === ItemType.Grenade &&
      currentItem.amount &&
      currentItem.amount > 0
    ) {
      // Decrease grenade count
      if (currentItem.amount > 1) {
        currentItem.amount--;
      } else {
        inventory.removeItem(inventory.currentSlotIndex);
      }

      // Create grenade projectile
      const grenade = new Grenade();
      grenade.activator = this.sessionId;
      grenade.position.x = data.position.x + data.direction.x * 1;
      grenade.position.y = data.position.y + data.direction.y * 1;
      grenade.direction.x = data.direction.x;
      grenade.direction.y = data.direction.y;

      this.state.grenades.set(grenade.id, grenade);

      // Broadcast grenade spawn to all clients
      this.broadcastToAll({
        type: "serverSpawn",
        name: "Grenade",
        sessionId: this.sessionId,
        id: grenade.id,
        activator: grenade.activator,
        position: grenade.position,
        direction: grenade.direction,
      });

      // Send updated inventory
      this.sendInventoryUpdate();

      console.log(`Player ${this.sessionId} threw a grenade`);
    }
  }

  handleMeleeAttack(data: any) {
    const inventory = this.state.inventories.get(this.sessionId);
    if (!inventory) return;

    const currentItem = inventory.getCurrentItem();
    if (!currentItem || currentItem.itemType !== ItemType.Hand) return;

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

  handleRequestInventory(data: any) {
    this.sendInventoryUpdate();
  }

  handleBulletCollision(data: any) {
    const bullet = this.state.bullets.get(data.id);
    if (bullet) {
      bullet.hasCollided = true;
    }
  }

  private sendInventoryUpdate() {
    const inventory = this.state.inventories.get(this.sessionId);
    if (!inventory) return;

    const socket = this.state.sockets.get(this.sessionId);
    if (socket) {
      socket.send(
        JSON.stringify({
          type: "fullInventoryUpdate",
          inventory: inventory.serialize(),
        })
      );
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
    const deltaTime = TICK_RATE / 1000;

    // Update player positions
    gameState.playerInputs.forEach((input, sessionId) => {
      const player = gameState.players.get(sessionId);
      if (!player || !player.isAlive) return;

      const inputMagnitude = Math.sqrt(
        input.horizontal * input.horizontal + input.vertical * input.vertical
      );

      let moveX = input.horizontal;
      let moveY = input.vertical;

      if (inputMagnitude > 0) {
        moveX /= inputMagnitude;
        moveY /= inputMagnitude;
      }

      player.position.x += moveX * MOVE_SPEED * deltaTime;
      player.position.y += moveY * MOVE_SPEED * deltaTime;

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
      const expired = bullet.onUpdate(TICK_RATE);

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

      broadcastToAll({
        type: "bulletMove",
        id: bulletId,
        position: {
          x: bullet.position.x,
          y: bullet.position.y,
        },
      });
    });

    // Remove bullets
    for (const id of bulletsToRemove) {
      gameState.bullets.delete(id);
      broadcastToAll({
        type: "serverUnspawn",
        id,
      });
    }

    // Update grenades
    const grenadesToRemove: string[] = [];

    gameState.grenades.forEach((grenade, grenadeId) => {
      const expired = grenade.onUpdate(TICK_RATE);

      // Check if grenade should explode
      if (expired && !grenade.hasExploded) {
        grenade.explode();

        // Apply damage to all players in explosion radius
        gameState.players.forEach((player, playerId) => {
          if (!player.isAlive) return;

          const distance = grenade.position.distance(player.position);

          if (distance <= grenade.explosionRadius) {
            // Calculate damage based on distance (closer = more damage)
            const damageMultiplier = 1 - distance / grenade.explosionRadius;
            const actualDamage = Math.floor(grenade.damage * damageMultiplier);

            if (actualDamage > 0) {
              const died = applyDamage(player, actualDamage);

              broadcastToAll({
                type: "healthUpdate",
                sessionId: player.sessionId,
                health: player.health,
                shield: player.shield,
                maxHealth: player.maxHealth,
                maxShield: player.maxShield,
              });

              if (died) {
                broadcastToAll({
                  type: "playerKilled",
                  sessionId: player.sessionId,
                });
              }
            }
          }
        });

        // Broadcast explosion effect
        broadcastToAll({
          type: "grenadeExplode",
          id: grenadeId,
          position: {
            x: grenade.position.x,
            y: grenade.position.y,
          },
          radius: grenade.explosionRadius,
        });

        grenadesToRemove.push(grenadeId);
        return;
      }

      if (expired) {
        grenadesToRemove.push(grenadeId);
        return;
      }

      // Send movement update
      broadcastToAll({
        type: "grenadeMove",
        id: grenadeId,
        position: {
          x: grenade.position.x,
          y: grenade.position.y,
        },
      });
    });

    // Remove exploded grenades
    for (const id of grenadesToRemove) {
      gameState.grenades.delete(id);
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
    const HIT_RADIUS = 0.5;

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
  const inventory = new Inventory();

  // Give player starting items
  inventory.addItem(1, ItemTemplates.Pistol());
  inventory.addItem(2, ItemTemplates.Rifle());
  inventory.addItem(3, ItemTemplates.HealthPack(4));
  inventory.addItem(4, ItemTemplates.ShieldPack(4));
  inventory.addItem(5, ItemTemplates.Grenade(3));

  gameState.players.set(sessionId, player);
  gameState.sockets.set(sessionId, ws);
  gameState.inventories.set(sessionId, inventory);
  gameState.playerInputs.set(sessionId, {
    horizontal: 0,
    vertical: 0,
    lastUpdate: Date.now(),
  });

  console.log("Player joined with id:", sessionId);

  sendInitialState(ws, sessionId, player, inventory);
  notifyPlayersOfNewJoin(sessionId, player);

  const messageHandler = new MessageHandler(sessionId, player, gameState);

  ws.on("message", (message: string) => {
    handleMessage(message, messageHandler);
  });

  ws.on("close", () => {
    handleDisconnection(sessionId);
  });
}

function sendInitialState(
  ws: WebSocket,
  sessionId: string,
  player: Player,
  inventory: Inventory
) {
  ws.send(
    JSON.stringify({
      type: "initialState",
      sessionId: sessionId,
      self: player,
      inventory: inventory.serialize(),
      others: Array.from(gameState.players.values())
        .filter((p) => p.sessionId !== sessionId)
        .map((p) => ({
          ...p,
          inventory: gameState.inventories.get(p.sessionId)?.serialize(),
        })),
    })
  );
}

function notifyPlayersOfNewJoin(sessionId: string, player: Player) {
  const inventory = gameState.inventories.get(sessionId);

  gameState.sockets.forEach((socket, id) => {
    if (id !== sessionId) {
      socket.send(
        JSON.stringify({
          type: "spawn",
          player: player,
          inventory: inventory?.serialize(),
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
      case "useItem":
        handler.handleUseItem(data);
        break;
      case "throwGrenade":
        handler.handleThrowGrenade(data);
        break;
      case "meleeAttack":
        handler.handleMeleeAttack(data);
        break;
      case "bulletCollide":
        handler.handleBulletCollision(data);
        break;
      case "requestInventory":
        handler.handleRequestInventory(data);
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
  gameState.inventories.delete(sessionId);

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
