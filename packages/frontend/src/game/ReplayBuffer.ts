import { InputAction } from "@stacktris/shared";
import { WSClient } from "../ws/WSClient";


type InputData = {
  action: InputAction;
  frame: number;
}

export class ReplayBuffer {

  buffer: InputData[] = [];


  constructor(private readonly ws: WSClient) {

  }

  add(input: InputData): void {
    this.buffer.push(input);
  }

  // Send out inputs to the server and flush the buffer.
  flush(): void {
    if (this.buffer.length === 0) return;
  
    this.ws.send({ type: 'game_action', buffer: this.buffer })
    this.buffer = [];
  }
}