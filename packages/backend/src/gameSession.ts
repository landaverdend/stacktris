import { ClientMsg, ServerMsg } from '@stacktris/shared';
import { PlayerSlot } from './types.js';
import { PlayerGame } from './playerGame.js';

export class GameSession {


  private players: Record<string, PlayerSlot> = {}
  private playerGames: Record<string, PlayerGame> = {};

  private running = false;

  private seed: number = Math.floor(Math.random() * 2 ** 32);

  constructor(players: PlayerSlot[], onEnd: (winnerId: string) => void) {
    for (const p of players) {
      this.players[p.playerId] = p;
    }

    this.start();
  }

  public onMessage(playerId: string, msg: ClientMsg): void {
    console.log(`[GameSession] onMessage: ${JSON.stringify(msg).slice(0, 80)}`);

    switch (msg.type) {
      case 'game_action':
        const ps = this.playerGames[playerId];
        ps?.handleInput(msg.buffer, msg.frame);
        break;
    }
  }

  public start(): void {
    this.seed = Math.floor(Math.random() * 2 ** 32);

    // Create PlayerGames AFTER seed is finalized so server and client share the same seed
    for (const playerId of Object.keys(this.players)) {
      this.playerGames[playerId] = new PlayerGame(this.seed);
    }

    this.broadcastToAll({ type: 'game_start', seed: this.seed });
    this.running = true;

    // send initial state snapshots to all players
    for (const ps of Object.values(this.playerGames)) {
      this.broadcastToAll({ type: 'game_snapshot', snapshot: ps.snapshot });
    }
  }

  public destroy(): void {
    this.running = false;
  }

  private broadcastToAll(msg: ServerMsg): void {
    for (const player of Object.values(this.players)) {
      player.sendFn(msg);
    }
  }
}
