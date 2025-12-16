import { Vector2 } from "../utils/vector2.ts";
import { ServerObject } from "./serverObject.ts";

export class Bullet extends ServerObject {
    direction: Vector2;
    speed: number;
    lifetime: number

    constructor() {
        super();
        this.direction = new Vector2();
        this.speed = 0.5;
        this.lifetime = 2000;
    }

    onUpdate(delta: number) {
        this.position.x += this.direction.x * this.speed;
        this.position.y += this.direction.y * this.speed;

        this.lifetime -= delta;

        return this.lifetime <= 0;
    }
}