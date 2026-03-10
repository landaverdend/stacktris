import { ClientMsg } from "@stacktris/shared";
import { PlayerSocket } from "./WSServer.js";


export class RoomManager {

  constructor() {
  }

  public onMessage(socket: PlayerSocket, msg: ClientMsg): void {
    console.log('[RoomManager] onMessage: ', msg, ' from ', socket.playerId);
  }

  public onDisconnect(socket: PlayerSocket): void {
    console.log('[RoomManager] onDisconnect: ', socket.playerId);
  }
}