use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{game::GameRoom, AppState};

// ── Client → Server messages ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMessage {
    CreateRoom { bet_sats: u64 },
    JoinRoom { room_id: String, bet_sats: u64 },
    GameAction { action: GameAction },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum GameAction {
    MoveLeft,
    MoveRight,
    MoveDown,
    Rotate,
    HardDrop,
}

// ── Server → Client messages ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    RoomCreated { room_id: String },
    RoomJoined { room_id: String },
    GameStart { countdown: u32 },
    GameState { room: GameRoom },
    GameOver { winner_id: String },
    Error { message: String },
}

// ── Handler ───────────────────────────────────────────────────────────────────

pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let player_id = Uuid::new_v4().to_string();
    tracing::info!("Player connected: {}", player_id);

    while let Some(Ok(msg)) = socket.recv().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let client_msg: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let _ = send(
                    &mut socket,
                    ServerMessage::Error {
                        message: e.to_string(),
                    },
                )
                .await;
                continue;
            }
        };

        match client_msg {
            ClientMessage::CreateRoom { bet_sats } => {
                let room_id = state.games.create_room(bet_sats);
                state.games.join_room(&room_id, player_id.clone()).ok();

                let _ = send(&mut socket, ServerMessage::RoomCreated { room_id }).await;
            }

            ClientMessage::JoinRoom { room_id, bet_sats } => {
                match state.games.join_room(&room_id, player_id.clone()) {
                    Ok(_) => {
                        let _ = send(
                            &mut socket,
                            ServerMessage::RoomJoined {
                                room_id: room_id.clone(),
                            },
                        )
                        .await;

                        // Check if room is now full and start game
                        if let Some(room) = state.games.get_room(&room_id) {
                            if room.is_full() {
                                state.games.start_game(&room_id);
                                let _ =
                                    send(&mut socket, ServerMessage::GameStart { countdown: 3 })
                                        .await;
                            }
                        }
                    }
                    Err(e) => {
                        let _ = send(
                            &mut socket,
                            ServerMessage::Error {
                                message: e.to_string(),
                            },
                        )
                        .await;
                    }
                }
            }

            ClientMessage::GameAction { action } => {
                // TODO: apply action to player's game state and broadcast to room
                tracing::debug!("Player {} action: {:?}", player_id, action);
            }
        }
    }

    tracing::info!("Player disconnected: {}", player_id);
}

async fn send(socket: &mut WebSocket, msg: ServerMessage) -> anyhow::Result<()> {
    let text = serde_json::to_string(&msg)?;
    socket.send(Message::Text(text.into())).await?;
    Ok(())
}
