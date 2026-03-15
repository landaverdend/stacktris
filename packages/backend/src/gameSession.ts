import { ClientMsg, ServerMsg } from "@stacktris/shared";
import { PlayerSlot } from "./types.js";
import { PlayerGame } from "./playerGame.js";


export class GameSession {

  private players: Map<string, PlayerSlot> = new Map();
  private playerGameStates: Record<string, PlayerGame> = {};

  private running = false;
  private tickTimeout: NodeJS.Timeout | null = null;

  private seed: number = Math.floor(Math.random() * 2 ** 32);
  private onEnd: (winnerId: string) => void;

  constructor(players: PlayerSlot[], onEnd: (winnerId: string) => void) {
    for (const p of players) {
      this.players.set(p.playerId, p);
      this.playerGameStates[p.playerId] = new PlayerGame(this.seed);
    }

    this.onEnd = onEnd;
    this.start();
  }


  public onMessage(playerId: string, msg: ClientMsg): void {
    console.log(`[GameSession] onMessage: ${msg.type} from player ${playerId}`);

    switch (msg.type) {
      case 'game_action':
        const ps = this.playerGameStates[playerId];
        console.log(`[GameSession] game action: ${JSON.stringify(msg.buffer)}`);
        break;
    }
  }

  public start(): void {
    this.seed = Math.floor(Math.random() * 2 ** 32);
    this.broadcastToAll({ type: 'game_start', seed: this.seed });

    this.running = true;

    // send initial state snapshots to all players
    for (const ps of Object.values(this.playerGameStates)) {
      this.broadcastToAll({ type: 'game_snapshot', snapshot: ps.snapshot });
    }
  }

  public destroy(): void {
    this.running = false;
    if (this.tickTimeout) clearTimeout(this.tickTimeout);
    this.tickTimeout = null;
  }

  private broadcastToAll(msg: ServerMsg): void {
    for (const [_, player] of this.players.entries()) {
      player.sendFn(msg);
    }
  }

}
