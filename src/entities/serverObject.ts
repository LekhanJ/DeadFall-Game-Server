import { Vector2 } from "../utils/vector2.ts";

export class ServerObject {
    id: string;
    name: string;
    position: Vector2;

    constructor() {
        this.id = crypto.randomUUID();
        this.name = "ServerObject";
        this.position = new Vector2();
    }
}