import { ServerMsg } from "@stacktris/shared";


export type SendFn = (msg: ServerMsg) => void;

export interface PlayerSlot {
  playerId: string;
  slotIndex: number;
  playerName: string;
  lightningAddress: string;
  sendFn: SendFn;
  ready: boolean;
  paid: boolean;
}