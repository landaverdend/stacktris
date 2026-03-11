import { ClientMsg } from "@stacktris/shared";
import { PlayerSlot } from "./types.js";


export class GameSession {
  private players: Map<string, PlayerSlot> = new Map();
  private onEnd: (winnerId: string) => void;

  constructor(players: PlayerSlot[], onEnd: (winnerId: string) => void) {
    for (const p of players) {
      this.players.set(p.playerId, p);
    }

    console.log(`[GameSession] created with ${this.players.size} players`);
    this.onEnd = onEnd;
  }

  public onMessage(playerId: string, msg: ClientMsg): void {
    // TODO: handle game messages (piece moves, holds, etc.)
    console.log(`[GameSession] onMessage: ${msg.type} from player ${playerId}`);
  }

  public destroy(): void {
    // TODO: stop any running game loops/timers
  }
}
