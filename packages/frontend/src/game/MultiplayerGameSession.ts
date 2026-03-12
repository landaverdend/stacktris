import { InputHandler } from './InputHandler';
import { MultiplayerGame } from './MultiplayerGame';
import { renderGameState, Canvases } from '../render/gameState';
import { WSClient } from '../ws/WSClient';
import { InputAction } from '@stacktris/shared';

export type { Canvases };

export class MultiplayerGameSession {

  private game: MultiplayerGame;
  private input: InputHandler;
  private rafId = 0;

  constructor(seed: number, ws: WSClient) {

    const onSend = (action: InputAction) => {
      console.log('[MultiplayerGameSession] onSend ', action);
      ws.send({ type: 'game_action', action });
    }

    this.game = new MultiplayerGame(seed, onSend);
    this.input = new InputHandler(action => this.game.input(action, performance.now()));
  }

  start(canvases: Canvases): void {
    this.game.reset();
    this.input.attach();

    const loop = (now: number) => {
      this.input.tick(now);
      this.game.tick(now);
      renderGameState(this.game.state, canvases, now);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
  }
}
