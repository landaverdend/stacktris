import { Board, ClientMsg, Emitter, FRAME_DURATION_MS, GameFrame, InputBuffer, MULTIPLAYER_GRAVITY_CONFIG, ServerMsg } from '@stacktris/shared';
import { PlayerSlot } from '../types.js';
import { PlayerGame } from './playerGame.js';

type RoundEventMap = {
  gameOver: string | null; // winnerId, or null for a draw
};

function isOutOfSync(client: GameFrame, server: GameFrame): boolean {
  if (client.isGameOver !== server.isGameOver) return true;
  if (client.gravityLevel !== server.gravityLevel) return true;
  if (client.holdPiece !== server.holdPiece) return true;
  if (client.holdUsed !== server.holdUsed) return true;

  // This is bad and we could do some bitwise ops to make this faster
  for (let r = 0; r < client.board.length; r++) {
    for (let c = 0; c < client.board[r].length; c++) {
      if (client.board[r][c] !== server.board[r][c]) return true;
    }
  }
  return false;
}

const MAX_LAG_FRAMES = 120; // 2 seconds @ 60fps
const WATCHDOG_INTERVAL_MS = 100;
export class Round {

  private players: Record<string, PlayerSlot> = {}
  private playerGames: Record<string, PlayerGame> = {};

  private alivePlayers: Set<string> = new Set();

  private gameEnded = false;

  private gravityLevel = MULTIPLAYER_GRAVITY_CONFIG.START_LEVEL;
  private gravityTimer: ReturnType<typeof setInterval> | null = null;

  private roundStartTime: number;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;

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

    this.roundStartTime = Date.now();
    this.watchdogInterval = setInterval(() => { this.checkPlayersForStall() }, WATCHDOG_INTERVAL_MS);

    this.startRound();
  }

  public onMessage(playerId: string, msg: ClientMsg): void {

    switch (msg.type) {
      case 'game_action':
        this.handlePlayerInput(playerId, msg.buffer, msg.frame);
        const ps = this.playerGames[playerId];
        ps?.handleInput(msg.buffer, msg.frame);
        if (ps) this.broadcastToAll({ type: 'opponent_piece_update', playerId, activePiece: ps.toGameFrame().activePiece }, playerId);
        break;

      case 'game_state_heartbeat': {
        const pg = this.playerGames[playerId];
        if (!pg) break;
        const serverFrame = pg.toGameFrame();
        console.log(`[heartbeat] ${playerId} frame=${msg.state.frame} gravity=${msg.state.gravityLevel} isGameOver=${msg.state.isGameOver}`);

        if (isOutOfSync(msg.state, serverFrame)) {
          console.warn(`[heartbeat] out of sync for ${playerId} at frame ${msg.state.frame}, sending correction`);
          this.players[playerId].sendFn({ type: 'game_state_update', frame: serverFrame });
        }
        break;
      }
      case 'player_died':
        this.broadcastPlayerDeath(playerId);
        this.killPlayer(playerId);
        break;
    }
  }

  public startRound(): void {
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
      pg.subscribe('pieceLocked', ({ board }) => {
        this.broadcastBoardUpdate(playerId, board);
        this.broadcastToAll({ type: 'opponent_piece_update', playerId, activePiece: null }, playerId);
      });
      pg.subscribe('gameOver', () => {
        this.broadcastPlayerDeath(playerId);
        this.killPlayer(playerId);
      });

      this.playerGames[playerId] = pg;
    }

    this.broadcastToAll({ type: 'game_start', seed: this.seed, roundStartTime: this.roundStartTime });

    // send initial state snapshots to all players
    for (const [playerId, pg] of Object.entries(this.playerGames)) {
      this.players[playerId].sendFn({ type: 'game_state_update', frame: pg.toGameFrame() });
      this.broadcastBoardUpdate(playerId, pg.toGameFrame().board);
    }

    this.startGravityTimer();
  }

  public destroy(): void {

    if (this.gravityTimer !== null) {
      clearInterval(this.gravityTimer);
      this.gravityTimer = null;
    }

    if (this.watchdogInterval !== null) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private startGravityTimer(): void {
    this.gravityLevel = MULTIPLAYER_GRAVITY_CONFIG.START_LEVEL;


    this.gravityTimer = setInterval(() => {
      if (this.gameEnded) return;
      if (this.gravityLevel >= MULTIPLAYER_GRAVITY_CONFIG.MAX_LEVEL) return;

      this.gravityLevel++;
      console.log(`[gravity_update] gravity level increased to ${this.gravityLevel}`);
      for (const pg of Object.values(this.playerGames)) {
        pg.setGravityLevel(this.gravityLevel);
      }
      this.broadcastToAll({ type: 'gravity_update', level: this.gravityLevel });

    }, MULTIPLAYER_GRAVITY_CONFIG.INTERVAL_MS);
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
      const winnerId = [...this.alivePlayers][0] ?? null;
      this.emitter.emit('gameOver', winnerId);

      console.log(`GAME OVER, winner is ${winnerId}`);

      this.destroy();
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


  /**
   * If player comes back from a disconnect, send them the current game state. 
   * @param playerId - player id of who sent input 
   * @param buffer - input buffer of actions. 
   * @param frame - frame of the game 
   */
  private handlePlayerInput(playerId: string, buffer: InputBuffer, frame: number) {
    const pg = this.playerGames[playerId];
    if (!pg) return;

    const serverFrame = Math.floor((Date.now() - this.roundStartTime) / FRAME_DURATION_MS);

    // Check if the player is too far behind- if so, send a corrective snapshot.
    if (serverFrame - frame > MAX_LAG_FRAMES) {
      this.players[playerId].sendFn({ type: 'game_state_update', frame: pg.toGameFrame() });
    }
  }

  /**
   * Check if any players are stalled and tick them to the server frame if they are. (If they DC)
   */
  private checkPlayersForStall() {
    const serverFrame = Math.floor((Date.now() - this.roundStartTime) / FRAME_DURATION_MS);
    for (const [playerId, pg] of Object.entries(this.playerGames)) {
      // console.log(`Player ${playerId} is at frame ${pg.frameCount}, server is at frame ${serverFrame}`);
      const delta = serverFrame - pg.frameCount;
      if (delta > MAX_LAG_FRAMES) {
        pg.tickTo(serverFrame) // advance gravity with no inputs
        this.broadcastToAll({ type: 'opponent_piece_update', playerId, activePiece: pg.toGameFrame().activePiece }, playerId);
      }
    }
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
