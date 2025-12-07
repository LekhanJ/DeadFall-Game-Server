import { Vector2 } from "../utils/vector2.ts";

export class Player {
  sessionId: string;
  username: string;
  position: Vector2;


  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.username = '';
    this.position  = new Vector2();
  }
}
