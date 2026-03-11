import { ServerMsg } from "@stacktris/shared";


export type SendFn = (msg: ServerMsg) => void;

export interface PlayerSlot {
  playerId: string;
  sendFn: SendFn;
  ready: boolean;
}