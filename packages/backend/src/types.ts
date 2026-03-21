import { ServerMsg } from "@stacktris/shared";


export type SendFn = (msg: ServerMsg) => void;

export interface PlayerSlot {
  playerId: string;
  playerName: string;
  sendFn: SendFn;
  ready: boolean;
  paid: boolean;
}