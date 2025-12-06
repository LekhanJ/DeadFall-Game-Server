export class Player {
  sessionId: string;
  username: string;
  

  x: number;
  y: number;
  speed: number;
  inputs: boolean[];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.username = '';

    this.x = 0;
    this.y = 0;
    this.speed = 5;

    this.inputs = [false, false, false, false];
  }
}
