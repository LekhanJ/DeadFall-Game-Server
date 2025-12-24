import { Vector2 } from "../utils/vector2.ts";

export class Player {
  sessionId: string;
  username: string;
  position: Vector2;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  isAlive: boolean;

  currentWeapon: string;
  currentSlotIndex: number;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.username = '';
    this.position = new Vector2();
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.maxShield = 100;
    this.shield = this.maxShield;
    this.isAlive = true;

    this.currentWeapon = "";
    this.currentSlotIndex = 0;
  }
}