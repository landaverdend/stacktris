import { Board, ClientMsg, Emitter, MULTIPLAYER_GRAVITY_CONFIG, ServerMsg } from '@stacktris/shared';
import { PlayerSlot } from './types.js';
import { PlayerGame } from './playerGame.js';

type GameSessionEventMap = {
  gameOver: string | null; // winnerId, or null for a draw
};

export class GameSession {

  private players: Record<string, PlayerSlot> = {}
  private playerGames: Record<string, PlayerGame> = {};
  private alivePlayers: Set<string> = new Set();
  private gameEnded = false;
  private gravityLevel = MULTIPLAYER_GRAVITY_CONFIG.START_LEVEL;
  private gravityTimer: ReturnType<typeof setInterval> | null = null;

  private emitter = new Emitter<GameSessionEventMap>();
  subscribe = this.emitter.subscribe.bind(this.emitter);

  private seed: number = Math.floor(Math.random() * 2 ** 32);

  constructor(players: PlayerSlot[]) {
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
    this.alivePlayers = new Set(Object.keys(this.players));

    for (const playerId of Object.keys(this.players)) {
      const pg = new PlayerGame(this.seed);

      pg.subscribe('attack', (lines) => this.routeGarbage(playerId, lines, pg.frameCount));
      pg.subscribe('pieceLocked', ({ board }) => this.broadcastBoardUpdate(playerId, board));
      pg.subscribe('gameOver', () => this.handlePlayerOut(playerId));

      this.playerGames[playerId] = pg;
    }

    this.broadcastToAll({ type: 'game_start', seed: this.seed });

    // send initial state snapshots to all players
    for (const [playerId, pg] of Object.entries(this.playerGames)) {
      this.players[playerId].sendFn({ type: 'game_snapshot', snapshot: pg.snapshot });
      this.broadcastBoardUpdate(playerId, pg.snapshot.board);
    }

    this.startGravityTimer();
  }

  public destroy(): void {
    this.stopGravityTimer();
  }

  private startGravityTimer(): void {
    this.gravityLevel = MULTIPLAYER_GRAVITY_CONFIG.START_LEVEL;
    this.gravityTimer = setInterval(() => {
      if (this.gameEnded) return;
      if (this.gravityLevel >= MULTIPLAYER_GRAVITY_CONFIG.MAX_LEVEL) return;
      this.gravityLevel++;
      this.broadcastToAll({ type: 'gravity_update', level: this.gravityLevel });
    }, MULTIPLAYER_GRAVITY_CONFIG.INTERVAL_MS);
  }

  private stopGravityTimer(): void {
    if (this.gravityTimer !== null) {
      clearInterval(this.gravityTimer);
      this.gravityTimer = null;
    }
  }

  private handlePlayerOut(playerId: string): void {
    if (this.gameEnded) return;
    this.alivePlayers.delete(playerId);

    if (this.alivePlayers.size === 1) {
      this.gameEnded = true;
      this.stopGravityTimer();
      const winnerId = [...this.alivePlayers][0];
      this.broadcastToAll({ type: 'game_over', winnerId });
      this.emitter.emit('gameOver', winnerId);
    } else if (this.alivePlayers.size === 0) {
      this.gameEnded = true;
      this.stopGravityTimer();
      this.broadcastToAll({ type: 'game_over', winnerId: null });
      this.emitter.emit('gameOver', null);
    }
  }

  private routeGarbage(attackerId: string, lines: number, triggerFrame: number): void {
    for (const [id, game] of Object.entries(this.playerGames)) {
      if (id === attackerId || !this.alivePlayers.has(id)) continue;
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
