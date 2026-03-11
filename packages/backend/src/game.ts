import { ClientMsg, ServerMsg } from "@stacktris/shared";
import { PlayerSlot } from "./types.js";


const TICK_INTERVAL_MS = 1000

export class GameSession {

  private players: Map<string, PlayerSlot> = new Map();
  tickInterval: NodeJS.Timeout | null = null;

  private onEnd: (winnerId: string) => void;

  constructor(players: PlayerSlot[], onEnd: (winnerId: string) => void) {

    for (const p of players) {
      this.players.set(p.playerId, p);
    }

    console.log(`[GameSession] created with ${this.players.size} players`);
    this.onEnd = onEnd;

    this.tickInterval = setInterval(() => this.onTick(), TICK_INTERVAL_MS);

  }


  private onTick(): void {
    console.log(`[GameSession] tick`);

    for (const [_, player] of this.players.entries()) {
    }

  }

  public onMessage(playerId: string, msg: ClientMsg): void {
    // TODO: handle game messages (piece moves, holds, etc.)
    console.log(`[GameSession] onMessage: ${msg.type} from player ${playerId}`);
  }


  public destroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
  }
}
