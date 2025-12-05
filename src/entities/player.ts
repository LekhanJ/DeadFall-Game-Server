import { WebSocket } from "ws";

export class Player {
  sessionId: string;

  x: number;
  y: number;
  speed: number;
  inputs: boolean[];

  constructor(sessionId: string) {
    this.sessionId = sessionId;

    this.x = 0;
    this.y = 0;
    this.speed = 5;

    this.inputs = [false, false, false, false];
  }
}
