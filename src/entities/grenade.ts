import { Vector2 } from "../utils/vector2.ts";
import { ServerObject } from "./serverObject.ts";

export class Grenade extends ServerObject {
  direction: Vector2;
  speed: number;
  initialSpeed: number;
  lifetime: number;
  hasExploded: boolean;
  activator: string;
  explosionRadius: number;
  damage: number;
  friction: number;
  minSpeed: number;

  constructor() {
    super();
    this.name = "Grenade";
    this.direction = new Vector2();
    this.initialSpeed = 0.4;        
    this.speed = this.initialSpeed;
    this.friction = 0.97;          
    this.minSpeed = 0.02;         
    this.lifetime = 3000;           
    this.hasExploded = false;
    this.activator = '';
    this.explosionRadius = 5.0;
    this.damage = 75;
  }

  onUpdate(delta: number): boolean {
    if (this.speed > this.minSpeed) {
      this.speed *= this.friction;
    } else {
      this.speed = 0;
    }

    if (this.speed > 0) {
      this.position.x += this.direction.x * this.speed;
      this.position.y += this.direction.y * this.speed;
    }

    this.lifetime -= delta;

    return this.lifetime <= 0 || this.hasExploded;
  }

  explode() {
    this.hasExploded = true;
  }
}