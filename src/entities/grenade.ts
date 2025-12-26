import { Vector2 } from "../utils/vector2.ts";
import { ServerObject } from "./serverObject.ts";

export class Grenade extends ServerObject {
  direction: Vector2;
  speed: number;
  lifetime: number;
  hasExploded: boolean;
  activator: string;
  explosionRadius: number;
  damage: number;

  constructor() {
    super();
    this.name = "Grenade";
    this.direction = new Vector2();
    this.speed = 0.25; 
    this.lifetime = 3000;
    this.hasExploded = false;
    this.activator = '';
    this.explosionRadius = 3.0;
    this.damage = 75;
  }

  onUpdate(delta: number): boolean {
    this.position.x += this.direction.x * this.speed;
    this.position.y += this.direction.y * this.speed;

    this.lifetime -= delta;
 
    return this.lifetime <= 0 || this.hasExploded;
  }

  explode() {
    this.hasExploded = true;
  }
}