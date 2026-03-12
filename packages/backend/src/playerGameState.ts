import { InputAction } from "@stacktris/shared";



export class PlayerGameState {


  constructor(seed: number) {

  }

  public tick() {

  }


  applyInput(input: InputAction) {
    console.log(`[PlayerGameState] applyInput: ${input}`);
  }
}