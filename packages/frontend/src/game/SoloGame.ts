import { GameState, GameWithBag, createGame } from '@stacktris/shared';

type OnStateChange = (state: GameState) => void;

export class SoloGame {
  private game: GameWithBag;
  private rafId: number | null = null;
  private onStateChange: OnStateChange;

  constructor(onStateChange: OnStateChange) {
    this.onStateChange = onStateChange;
    this.game = createGame();
  }

  get state(): GameState {
    return this.game.state;
  }

  start(): void {
    this.game = createGame();
    this.onStateChange(this.game.state);
    this.startLoop();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startLoop(): void {
    const loop = () => {
      // Game loop tick — gravity, lock delay, etc. will be added here
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}
