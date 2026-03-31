import { Board, ClientMsg, Emitter, FRAME_DURATION_MS, GameFrame, InputBuffer, ServerMsg } from '@stacktris/shared';
import { PlayerSlot } from '../types.js';
import { PlayerGame } from './playerGame.js';

type RoundEventMap = {
  gameOver: string | null; // winnerId, or null for a draw
};

interface FrameDiff {
  // Fields that trigger a correction.
  correctionDiffs: string[];
  // Fields logged for diagnosis but excluded from the sync check.
  infoDiffs: string[];
}

function diffGameFrames(client: GameFrame, server: GameFrame): FrameDiff {
  const correctionDiffs: string[] = [];
  const infoDiffs: string[] = [];

  if (client.isGameOver !== server.isGameOver)
    correctionDiffs.push(`isGameOver: client=${client.isGameOver} server=${server.isGameOver}`);

  if (client.holdPiece !== server.holdPiece)
    correctionDiffs.push(`holdPiece: client=${client.holdPiece} server=${server.holdPiece}`);

  if (client.holdUsed !== server.holdUsed)
    correctionDiffs.push(`holdUsed: client=${client.holdUsed} server=${server.holdUsed}`);

  if (client.bagPosition !== server.bagPosition)
    correctionDiffs.push(`bagPosition: client=${client.bagPosition} server=${server.bagPosition}`);

  const cgStr = JSON.stringify(client.pendingGarbage);
  const sgStr = JSON.stringify(server.pendingGarbage);
  if (cgStr !== sgStr)
    infoDiffs.push(`pendingGarbage: client=${cgStr} server=${sgStr}`);

  const boardDiffs: string[] = [];
  for (let r = 0; r < client.board.length; r++) {
    for (let c = 0; c < client.board[r].length; c++) {
      if (client.board[r][c] !== server.board[r][c])
        boardDiffs.push(`[${r},${c}]: client=${client.board[r][c]} server=${server.board[r][c]}`);
    }
  }
  if (boardDiffs.length > 0)
    correctionDiffs.push(`board (${boardDiffs.length} cell(s) differ): ${boardDiffs.slice(0, 10).join(', ')}${boardDiffs.length > 10 ? ` ... +${boardDiffs.length - 10} more` : ''}`);

  // gravityLevel: excluded from corrections (float32 precision loss in heartbeat codec
  // causes false positives), but logged to correlate corrections with gravity changes.
  if (client.gravityLevel !== server.gravityLevel)
    infoDiffs.push(`gravityLevel: client=${client.gravityLevel} server=${server.gravityLevel}`);

  // activePiece: not part of sync check but useful for diagnosing mid-flight drift.
  const cp = client.activePiece;
  const sp = server.activePiece;
  if (cp && sp) {
    const apDiffs: string[] = [];
    if (cp.kind !== sp.kind) apDiffs.push(`kind: client=${cp.kind} server=${sp.kind}`);
    if (cp.row !== sp.row) apDiffs.push(`row: client=${cp.row} server=${sp.row}`);
    if (cp.col !== sp.col) apDiffs.push(`col: client=${cp.col} server=${sp.col}`);
    if (cp.rotation !== sp.rotation) apDiffs.push(`rotation: client=${cp.rotation} server=${sp.rotation}`);
    if (apDiffs.length > 0)
      infoDiffs.push(`activePiece: ${apDiffs.join(', ')}`);
  } else if (!!cp !== !!sp) {
    infoDiffs.push(`activePiece: client=${cp ? 'present' : 'null'} server=${sp ? 'present' : 'null'}`);
  }

  return { correctionDiffs, infoDiffs };
}

const MAX_LAG_FRAMES = 120; // 2 seconds @ 60fps
const WATCHDOG_INTERVAL_MS = 100;
export class Round {

  private players: Record<string, PlayerSlot> = {}
  private playerGames: Record<string, PlayerGame> = {};

  private alivePlayers: Set<string> = new Set();

  private gameEnded = false;

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
        if (ps) this.broadcastToAll({ type: 'opponent_piece_update', slotIndex: this.players[playerId].slotIndex, activePiece: ps.toGameFrame().activePiece }, playerId);
        break;

      case 'game_state_heartbeat': {
        const pg = this.playerGames[playerId];
        if (!pg) break;
        const serverFrame = pg.toGameFrame();
        const frameDelta = serverFrame.frame - msg.state.frame;
        console.log(`[heartbeat] ${this.players[playerId].playerName} clientFrame=${msg.state.frame} serverFrame=${serverFrame.frame} delta=${frameDelta} isGameOver=${msg.state.isGameOver}`);

        const { correctionDiffs, infoDiffs } = diffGameFrames(msg.state, serverFrame);

        if (correctionDiffs.length > 0) {
          const allDiffs = [...correctionDiffs, ...(infoDiffs.length > 0 ? [`[info] ${infoDiffs.join(' | ')}`] : [])];
          console.warn(`[heartbeat] out of sync for ${this.players[playerId].playerName} at frame ${msg.state.frame}, sending correction\n  ${allDiffs.join('\n  ')}`);
          this.players[playerId].sendFn({ type: 'game_state_update', frame: serverFrame });
        } else if (infoDiffs.length > 0) {
          console.log(`[heartbeat] in sync (info) for ${this.players[playerId].playerName} at frame ${msg.state.frame}: ${infoDiffs.join(' | ')}`);
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
      pg.subscribe('pendingGarbage', (queue) => {
        this.players[playerId].sendFn({ type: 'garbage_queue_sync', queue });
      });
      pg.subscribe('pieceLocked', ({ board }) => {
        this.broadcastBoardUpdate(playerId, board);
        this.broadcastToAll({ type: 'opponent_piece_update', slotIndex: this.players[playerId].slotIndex, activePiece: null }, playerId);
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

  }

  public destroy(): void {

    if (this.watchdogInterval !== null) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  /** Remove a player from the session — used for both engine game-over and disconnects. */
  public killPlayer(playerId: string): void {
    if (this.gameEnded) return;
    if (!this.alivePlayers.has(playerId)) return;

    // Remove from gameplay structures; playerOrder kept as tombstone (advanceTarget skips non-alive)
    // players is intentionally kept so the removed player still receives the final game_over broadcast
    console.log(`[player] ${this.players[playerId].playerName} eliminated (frame=${this.playerGames[playerId]?.frameCount ?? 'n/a'} aliveRemaining=${this.alivePlayers.size - 1})`);
    delete this.playerGames[playerId];
    delete this.targetIndices[playerId];
    this.alivePlayers.delete(playerId);

    if (this.alivePlayers.size <= 1) {
      this.gameEnded = true;
      const winnerId = [...this.alivePlayers][0] ?? null;
      this.emitter.emit('gameOver', winnerId);

      console.log(`[game] over — winner: ${winnerId ? this.players[winnerId]?.playerName : 'draw'}`);

      this.destroy();
    }
  }

  private routeGarbage(attackerId: string, lines: number, triggerFrame: number): void {
    const targetId = this.advanceTarget(attackerId);
    if (!targetId) return;
    const gap = this.playerGames[targetId].addGarbage(lines, triggerFrame);
    const targetQueue = this.playerGames[targetId].toGameFrame().pendingGarbage;
    console.log(`[garbage:route] ${this.players[attackerId].playerName} → ${this.players[targetId].playerName}: ${lines}L gap=${gap} sentFrame=${triggerFrame} triggerFrame=${triggerFrame + 240} | targetQueue depth=${targetQueue.length} totalLines=${targetQueue.reduce((s, g) => s + g.lines, 0)}`);
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
      const delta = serverFrame - pg.frameCount;
      if (delta > MAX_LAG_FRAMES) {

        console.log(`[WATCHDOG] Player ${playerId} is at frame ${pg.frameCount}, server is at frame ${serverFrame}`);
        pg.tickTo(serverFrame) // advance gravity with no inputs
        this.broadcastToAll({ type: 'opponent_piece_update', slotIndex: this.players[playerId].slotIndex, activePiece: pg.toGameFrame().activePiece }, playerId);
      }
    }
  }

  private broadcastBoardUpdate(senderId: string, board: Board): void {
    const slotIndex = this.players[senderId].slotIndex;
    for (const id of Object.keys(this.players)) {
      if (id === senderId) continue;
      this.players[id].sendFn({ type: 'opponent_board_update', slotIndex, board });
    }
  }

  private broadcastPlayerDeath(playerId: string) {
    const slotIndex = this.players[playerId].slotIndex;
    for (const id of Object.keys(this.players)) {
      if (id === playerId) continue;
      this.players[id].sendFn({ type: 'game_player_died', slotIndex });
    }
  }

  private broadcastToAll(msg: ServerMsg, exceptId?: string): void {
    for (const player of Object.values(this.players)) {
      if (player.playerId === exceptId) continue;
      player.sendFn(msg);
    }
  }

}
