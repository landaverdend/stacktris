import { Board, ClientMsg, Emitter, InputBuffer, MULTIPLAYER_GRAVITY_CONFIG, ServerMsg } from '@stacktris/shared';
import { PlayerSlot } from '../types.js';
import { PlayerGame } from './playerGame.js';

type RoundEventMap = {
  gameOver: string | null; // winnerId, or null for a draw
};

export class Round {

  private players: Record<string, PlayerSlot> = {}
  private playerGames: Record<string, PlayerGame> = {};

  private alivePlayers: Set<string> = new Set();

  private gameEnded = false;

  private gravityLevel = MULTIPLAYER_GRAVITY_CONFIG.START_LEVEL;
  private gravityTimer: ReturnType<typeof setInterval> | null = null;

  // PPT-style targeting: stable player order + per-attacker index into that order
  private playerOrder: string[] = [];
  private targetIndices: Record<string, number> = {};

  private emitter = new Emitter<RoundEventMap>();
  subscribe = this.emitter.subscribe.bind(this.emitter);

  private seed: number = Math.floor(Math.random() * 2 ** 32);

  constructor(players: PlayerSlot[]) {
    for (const p of players) {
      this.players[p.playerId] = p;
    }

    this.start();
  }

  public onMessage(playerId: string, msg: ClientMsg): void {

    switch (msg.type) {
      case 'game_action':
        const ps = this.playerGames[playerId];
        ps?.handleInput(msg.buffer, msg.frame);
        // Relay player inputs to other players
        this.broadcastToAll({ type: 'game_player_input', playerId, inputBuffer: msg.buffer }, playerId);
        break;
      case 'player_died':
        this.broadcastPlayerDeath(playerId);
        this.killPlayer(playerId);
        break;
    }
  }

  public start(): void {
    this.seed = Math.floor(Math.random() * 2 ** 32);

    // Create PlayerGames AFTER seed is finalized so server and client share the same seed
    this.playerOrder = Object.keys(this.players);
    this.alivePlayers = new Set(this.playerOrder);

    // Each player starts targeting the next player in order
    for (let i = 0; i < this.playerOrder.length; i++) {
      this.targetIndices[this.playerOrder[i]] = (i + 1) % this.playerOrder.length;
    }

    for (const playerId of Object.keys(this.players)) {
      const pg = new PlayerGame(this.seed);

      pg.subscribe('attack', (lines) => this.routeGarbage(playerId, lines, pg.frameCount));
      pg.subscribe('pieceLocked', ({ board }) => this.broadcastBoardUpdate(playerId, board));
      pg.subscribe('gameOver', () => {
        this.broadcastPlayerDeath(playerId);
        this.killPlayer(playerId);
      });

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

  /** Remove a player from the session — used for both engine game-over and disconnects. */
  public killPlayer(playerId: string): void {
    if (this.gameEnded) return;
    if (!this.alivePlayers.has(playerId)) return;

    // Remove from gameplay structures; playerOrder kept as tombstone (advanceTarget skips non-alive)
    // players is intentionally kept so the removed player still receives the final game_over broadcast
    delete this.playerGames[playerId];
    delete this.targetIndices[playerId];
    this.alivePlayers.delete(playerId);

    if (this.alivePlayers.size <= 1) {
      this.gameEnded = true;
      this.stopGravityTimer();
      const winnerId = [...this.alivePlayers][0] ?? null;
      this.emitter.emit('gameOver', winnerId);
    }
  }

  private routeGarbage(attackerId: string, lines: number, triggerFrame: number): void {
    const targetId = this.advanceTarget(attackerId);
    if (!targetId) return;
    this.playerGames[targetId].addGarbage(lines, triggerFrame);
    this.players[targetId].sendFn({ type: 'game_garbage_incoming', lines, triggerFrame });
  }

  /** Returns the next alive target for the attacker and advances their index. */
  private advanceTarget(attackerId: string): string | null {
    const n = this.playerOrder.length;
    let idx = this.targetIndices[attackerId];

    for (let i = 0; i < n; i++) {
      const candidate = this.playerOrder[idx];
      idx = (idx + 1) % n;
      if (candidate !== attackerId && this.alivePlayers.has(candidate)) {
        this.targetIndices[attackerId] = idx;
        return candidate;
      }
    }
    return null;
  }

  private broadcastBoardUpdate(senderId: string, board: Board): void {
    for (const id of Object.keys(this.players)) {
      if (id === senderId) continue;
      this.players[id].sendFn({ type: 'opponent_board_update', playerId: senderId, board });
    }
  }

  private broadcastPlayerDeath(playerId: string) {
    for (const id of Object.keys(this.players)) {
      if (id === playerId) continue;

      this.players[id].sendFn({ type: 'game_player_died', playerId: playerId })
    }
  }

  private broadcastToAll(msg: ServerMsg, exceptId?: string): void {
    for (const player of Object.values(this.players)) {
      if (player.playerId === exceptId) continue;
      player.sendFn(msg);
    }
  }



}
