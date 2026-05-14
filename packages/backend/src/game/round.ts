import { Board, ClientMsg, FRAME_DURATION_MS, GameFrame, InputBuffer, RoundBase, ServerMsg } from '@stacktris/shared';
import { PlayerSlot } from '../types.js';
import { PlayerGame } from './playerGame.js';

interface FrameDiff {
  correctionDiffs: string[];
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

  if (client.gravityLevel !== server.gravityLevel)
    infoDiffs.push(`gravityLevel: client=${client.gravityLevel} server=${server.gravityLevel}`);

  const cp = client.activePiece;
  const sp = server.activePiece;
  if (cp && sp) {
    const apDiffs: string[] = [];
    if (cp.kind !== sp.kind) apDiffs.push(`kind: client=${cp.kind} server=${sp.kind}`);
    if (cp.row !== sp.row) apDiffs.push(`row: client=${cp.row} server=${sp.row}`);
    if (cp.col !== sp.col) apDiffs.push(`col: client=${cp.col} server=${sp.col}`);
    if (cp.rotation !== sp.rotation) apDiffs.push(`rotation: client=${cp.rotation} server=${sp.rotation}`);
    if (apDiffs.length > 0) infoDiffs.push(`activePiece: ${apDiffs.join(', ')}`);
  } else if (!!cp !== !!sp) {
    infoDiffs.push(`activePiece: client=${cp ? 'present' : 'null'} server=${sp ? 'present' : 'null'}`);
  }

  return { correctionDiffs, infoDiffs };
}

const MAX_LAG_FRAMES = 120;
const WATCHDOG_INTERVAL_MS = 100;

export class Round extends RoundBase<PlayerGame> {
  private readonly slots: Record<string, PlayerSlot>;
  private readonly roundStartTime: number;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;

  constructor(playerSlots: PlayerSlot[]) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const games: Record<string, PlayerGame> = {};
    const slots: Record<string, PlayerSlot> = {};

    for (const slot of playerSlots) {
      games[slot.playerId] = new PlayerGame(seed, slot.playerName);
      slots[slot.playerId] = slot;
    }

    super(games, seed);
    this.slots = slots;
    this.roundStartTime = Date.now();

    // Transport-specific player subscriptions (base handles 'attack' and 'gameOver')
    for (const [playerId, pg] of Object.entries(this.players)) {
      pg.subscribe('pendingGarbage', (queue) => {
        slots[playerId].sendFn({ type: 'garbage_queue_sync', queue });
      });
      pg.subscribe('pieceLocked', ({ board }) => {
        this.broadcastBoardUpdate(playerId, board);
        this.broadcastToAll({ type: 'opponent_piece_update', slotIndex: slots[playerId].slotIndex, activePiece: null }, playerId);
      });
    }

    this.watchdogInterval = setInterval(() => this.checkPlayersForStall(), WATCHDOG_INTERVAL_MS);

    this.broadcastToAll({ type: 'game_start', seed: this.seed, roundStartTime: this.roundStartTime });
    for (const [playerId, pg] of Object.entries(this.players)) {
      slots[playerId].sendFn({ type: 'game_state_update', frame: pg.toGameFrame() });
      this.broadcastBoardUpdate(playerId, pg.toGameFrame().board);
    }
  }

  // ── Template method overrides ───────────────────────────────────────────────

  protected onKillPlayer(playerId: string): void {
    console.log(`[player] ${this.slots[playerId].playerName} eliminated (frame=${this.players[playerId]?.frameCount ?? 'n/a'} aliveRemaining=${this.alivePlayers.size})`);
    this.broadcastPlayerDeath(playerId);
  }

  protected onGameOver(winnerId: string | null): void {
    console.log(`[game] over — winner: ${winnerId ? this.slots[winnerId]?.playerName : 'draw'}`);
    this.destroy();
  }

  protected onRouteGarbage(attackerId: string, targetId: string, lines: number, frame: number, gap: number): void {
    const targetQueue = this.players[targetId].toGameFrame().pendingGarbage;
    console.log(`[garbage:route] ${this.slots[attackerId].playerName} → ${this.slots[targetId].playerName}: ${lines}L gap=${gap} sentFrame=${frame} | targetQueue depth=${targetQueue.length} totalLines=${targetQueue.reduce((s, g) => s + g.lines, 0)}`);
  }

  // ── WS message handling ─────────────────────────────────────────────────────

  public onMessage(playerId: string, msg: ClientMsg): void {
    switch (msg.type) {
      case 'game_action': {
        const pg = this.players[playerId];
        if (!pg) break;
        pg.handleInput(msg.buffer, msg.frame);
        this.broadcastToAll({ type: 'opponent_piece_update', slotIndex: this.slots[playerId].slotIndex, activePiece: pg.toGameFrame().activePiece }, playerId);
        break;
      }
      case 'game_state_heartbeat': {
        const pg = this.players[playerId];
        if (!pg) break;
        const serverFrame = pg.toGameFrame();
        const frameDelta = serverFrame.frame - msg.state.frame;
        console.log(`[heartbeat] ${this.slots[playerId].playerName} clientFrame=${msg.state.frame} serverFrame=${serverFrame.frame} delta=${frameDelta} isGameOver=${msg.state.isGameOver}`);
        const { correctionDiffs, infoDiffs } = diffGameFrames(msg.state, serverFrame);
        if (correctionDiffs.length > 0) {
          const allDiffs = [...correctionDiffs, ...(infoDiffs.length > 0 ? [`[info] ${infoDiffs.join(' | ')}`] : [])];
          console.warn(`[heartbeat] out of sync for ${this.slots[playerId].playerName} at frame ${msg.state.frame} (correction disabled)\n  ${allDiffs.join('\n  ')}`);
        } else if (infoDiffs.length > 0) {
          console.log(`[heartbeat] in sync (info) for ${this.slots[playerId].playerName} at frame ${msg.state.frame}: ${infoDiffs.join(' | ')}`);
        }
        break;
      }
      case 'player_died':
        this.broadcastPlayerDeath(playerId);
        this.killPlayer(playerId);
        break;
    }
  }

  public destroy(): void {
    if (this.watchdogInterval !== null) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  // ── Watchdog ────────────────────────────────────────────────────────────────

  private checkPlayersForStall(): void {
    const serverFrame = Math.floor((Date.now() - this.roundStartTime) / FRAME_DURATION_MS);
    for (const [playerId, pg] of Object.entries(this.players)) {
      if (!this.alivePlayers.has(playerId)) continue;
      const delta = serverFrame - pg.frameCount;
      if (delta > MAX_LAG_FRAMES) {
        console.log(`[WATCHDOG] Player ${playerId} is at frame ${pg.frameCount}, server is at frame ${serverFrame}`);
        pg.tickTo(serverFrame);
        this.broadcastToAll({ type: 'opponent_piece_update', slotIndex: this.slots[playerId].slotIndex, activePiece: pg.toGameFrame().activePiece }, playerId);
      }
    }
  }

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  private broadcastBoardUpdate(senderId: string, board: Board): void {
    const slotIndex = this.slots[senderId].slotIndex;
    for (const id of Object.keys(this.slots)) {
      if (id === senderId) continue;
      this.slots[id].sendFn({ type: 'opponent_board_update', slotIndex, board });
    }
  }

  private broadcastPlayerDeath(playerId: string): void {
    const slotIndex = this.slots[playerId].slotIndex;
    for (const id of Object.keys(this.slots)) {
      if (id === playerId) continue;
      this.slots[id].sendFn({ type: 'game_player_died', slotIndex });
    }
  }

  private broadcastToAll(msg: ServerMsg, exceptId?: string): void {
    for (const slot of Object.values(this.slots)) {
      if (slot.playerId === exceptId) continue;
      slot.sendFn(msg);
    }
  }
}
