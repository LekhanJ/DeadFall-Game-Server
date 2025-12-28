import { Vector2 } from "../utils/vector2.ts";
import { ServerObject } from "./serverObject.ts";

export const BulletType = {
  Pistol: "pistol",
  Rifle: "rifle",
  Sniper: "sniper",
  Shotgun: "shotgun",
} as const;

export type BulletType = typeof BulletType[keyof typeof BulletType];

export class Bullet extends ServerObject {
  direction: Vector2;
  speed: number;
  lifetime: number;
  hasCollided: boolean;
  activator: string;
  bulletType: BulletType;
  damage: number;

  constructor(bulletType: BulletType = BulletType.Pistol) {
    super();
    this.direction = new Vector2();
    this.hasCollided = false;
    this.activator = "";
    this.speed = 0;
    this.lifetime = 0;
    this.damage = 0;
    this.bulletType = bulletType;

    // Set properties based on bullet type
    this.applyBulletTypeProperties(bulletType);
  }

  private applyBulletTypeProperties(type: BulletType) {
    switch (type) {
      case BulletType.Pistol:
        this.speed = 0.5;
        this.lifetime = 2000; // 2 seconds
        this.damage = 15;
        break;

      case BulletType.Rifle:
        this.speed = 0.7;
        this.lifetime = 2500;
        this.damage = 25;
        break;

      case BulletType.Sniper:
        this.speed = 1.2;
        this.lifetime = 3000;
        this.damage = 75;
        break;

      case BulletType.Shotgun:
        this.speed = 0.45;
        this.lifetime = 1500; // Shorter range
        this.damage = 12; // Per pellet
        break;
    }
  }

  onUpdate(delta: number): boolean {
    this.position.x += this.direction.x * this.speed;
    this.position.y += this.direction.y * this.speed;
    this.lifetime -= delta;
    return this.lifetime <= 0 || this.hasCollided;
  }

  getDamage(): number {
    return this.damage;
  }
}