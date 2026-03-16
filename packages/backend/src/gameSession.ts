import { Board, ClientMsg, ServerMsg } from '@stacktris/shared';
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
      const pg = new PlayerGame(this.seed);
      pg.subscribe('attack', (lines) => this.routeGarbage(playerId, lines, pg.frameCount));
      pg.subscribe('pieceLocked', ({ board }) => this.broadcastBoardUpdate(playerId, board));
      this.playerGames[playerId] = pg;
    }

    this.broadcastToAll({ type: 'game_start', seed: this.seed });
    this.running = true;

    // send initial state snapshots to all players
    for (const [playerId, pg] of Object.entries(this.playerGames)) {
      this.players[playerId].sendFn({ type: 'game_snapshot', snapshot: pg.snapshot });
      this.broadcastBoardUpdate(playerId, pg.snapshot.board);
    }
  }

  public destroy(): void {
    this.running = false;
  }

  private routeGarbage(attackerId: string, lines: number, triggerFrame: number): void {
    for (const [id, game] of Object.entries(this.playerGames)) {
      if (id === attackerId) continue;
      game.addGarbage(lines, triggerFrame);
      this.players[id].sendFn({ type: 'game_garbage_incoming', lines, triggerFrame });
    }
  }

  private broadcastBoardUpdate(senderId: string, board: Board): void {
    for (const id of Object.keys(this.players)) {
      if (id === senderId) continue;
      this.players[id].sendFn({ type: 'opponent_board_update', playerId: senderId, board });
    }
  }

  private broadcastToAll(msg: ServerMsg): void {
    for (const player of Object.values(this.players)) {
      player.sendFn(msg);
    }
  }
}
