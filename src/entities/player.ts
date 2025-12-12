import { Vector2 } from "../utils/vector2.ts";

export class Player {
  sessionId: string;
  username: string;
  position: Vector2;
  health: number;
  maxHealth: number;
  isAlive: boolean;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.username = '';
    this.position  = new Vector2();
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.isAlive = true;
  }
}
