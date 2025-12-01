import { WebSocket } from "ws";

export class Player {
  sessionId: string;
  ws: WebSocket;

  x: number;
  y: number;
  speed: number;
  inputs: boolean[];

  constructor(sessionId: string, ws: WebSocket) {
    this.sessionId = sessionId;
    this.ws = ws;

    this.x = 300;
    this.y = 300;
    this.speed = 5;

    this.inputs = [false, false, false, false];
  }
}
