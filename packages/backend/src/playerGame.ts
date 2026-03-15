import {
  GameEngine,
  GameSnapshot,
  InputBuffer,
} from "@stacktris/shared";


export class PlayerGame {

  private gameEngine: GameEngine;


  constructor(seed: number) {
    this.gameEngine = new GameEngine({ seed })
    console.log('PlayerGame constructor', seed);
  }

  get snapshot(): GameSnapshot {
    return {
      board: this.gameEngine.getState().board,
      activePiece: this.gameEngine.getState().activePiece,
      holdPiece: this.gameEngine.getState().holdPiece,
    }
  }


  /**
   * When we receive a batch of inputs, we need to run them against the game engine to determine if the state is valid. 
   * @param input 
   */
  handleInput(batch: InputBuffer) {
    for (const i of batch) {

    }
  }

}


// export class PlayerGameState {

//   private game: GameContext;
//   pendingGarbage: number = 0;

//   constructor(seed: number) {
//     this.game = createGame({ levelStrategy: levelFromLines }, seed);
//   }

//   get snapshot(): GameSnapshot {
//     return {
//       board: this.game.state.board,
//       activePiece: this.game.state.activePiece,
//       holdPiece: this.game.state.holdPiece,
//     }
//   }

//   get state(): GameState {
//     return this.game.state;
//   }

//   get isGameOver(): boolean {
//     return this.game.state.isGameOver;
//   }

//   /**
//    * Applies an input action to the game state. If it  
//    * @param input 
//    * @returns 
//    */
//   applyInput(input: InputAction, activePiece: ActivePiece): boolean {
//     if (this.game.state.isGameOver) return false;
//     console.log(`active piece from the client: ${JSON.stringify(activePiece)}`);
//     console.log(`active piece from the game state: ${JSON.stringify(this.game.state.activePiece)}`);

//     // TODO: given the active piece from the client- can we determine that it was possible to get to that position from the shadow state?
//     this.game = applyInput(this.game, input, Date.now());
//     return true;
//   }


//   /**
//    * Given the input buffer, run the simulation and validate the resultant state.
//    */
//   runSim(buffer: InputBuffer) {
//     console.log(`[PlayerGameState] running simulation for buffer: ${JSON.stringify(buffer)}`);

//   }

// }
