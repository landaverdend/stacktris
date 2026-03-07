use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::protocol::{ClientMsg, ServerMsg};
use crate::room::RoomCmd;
use crate::AppState;

// ── Types ─────────────────────────────────────────────────────────────────────

pub type PlayerId = Arc<str>;

// ── Registry ──────────────────────────────────────────────────────────────────

/// Tracks every live WebSocket connection. Anything that holds an `Arc<SessionRegistry>`
/// can push a message to any connected player by ID — without touching the socket
/// directly. The room actor will use this to broadcast game state.
pub struct SessionRegistry {
    senders: RwLock<HashMap<Arc<str>, mpsc::Sender<ServerMsg>>>,
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self {
            senders: RwLock::new(HashMap::new()),
        }
    }

    async fn register(&self, id: PlayerId, tx: mpsc::Sender<ServerMsg>) {
        self.senders.write().await.insert(id, tx);
    }

    async fn remove(&self, id: &str) {
        self.senders.write().await.remove(id);
    }

    /// Push a message to a player if they're still connected. Silently drops
    /// the message if the player has disconnected or their channel is full.
    pub async fn send(&self, id: &str, msg: ServerMsg) {
        if let Some(tx) = self.senders.read().await.get(id) {
            let _ = tx.try_send(msg);
        }
    }

    /// Clone the sender for a connected player so the room actor can hold it.
    pub async fn get_sender(&self, id: &str) -> Option<mpsc::Sender<ServerMsg>> {
        self.senders.read().await.get(id).cloned()
    }

    pub async fn connected_count(&self) -> usize {
        self.senders.read().await.len()
    }
}

// ── WS entry point ────────────────────────────────────────────────────────────

pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

// ── Per-connection task ───────────────────────────────────────────────────────

/// One tokio task per connected player. Runs a select! loop over:
///   - incoming WebSocket frames  → parse ClientMsg → dispatch
///   - outgoing ServerMsgs        → serialize → write to WebSocket
///
/// The player's mpsc::Sender is stored in SessionRegistry so that other parts
/// of the system (later: room actors) can push messages here without needing
/// to hold a reference to the socket.
async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let player_id: PlayerId = Uuid::new_v4().to_string().into();
    let (tx, mut rx) = mpsc::channel::<ServerMsg>(32);

    state.sessions.register(player_id.clone(), tx).await;
    tracing::info!(id = %player_id, "connected  (total: {})", state.sessions.connected_count().await);

    loop {
        tokio::select! {
            // ── Inbound from WebSocket ─────────────────────────────────────
            ws_msg = socket.recv() => {
                match ws_msg {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<ClientMsg>(&text) {
                            Ok(msg) => on_client_msg(msg, &player_id, &state).await,
                            Err(e) => {
                                let _ = state.sessions.send(
                                    &player_id,
                                    ServerMsg::Error { message: e.to_string() },
                                ).await;
                            }
                        }
                    }
                    // Graceful close or connection dropped
                    Some(Ok(Message::Close(_))) | None => break,
                    // Ping/Pong/Binary — ignore
                    _ => {}
                }
            }

            // ── Outbound to WebSocket ──────────────────────────────────────
            Some(server_msg) = rx.recv() => {
                let text = match serde_json::to_string(&server_msg) {
                    Ok(t)  => t,
                    Err(e) => {
                        tracing::error!("serialize error: {}", e);
                        continue;
                    }
                };
                if socket.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    }

    state.sessions.remove(&player_id).await;
    tracing::info!(id = %player_id, "disconnected (total: {})", state.sessions.connected_count().await);
}

// ── Message dispatch ──────────────────────────────────────────────────────────

/// Routes an incoming client message to the appropriate subsystem.
/// Right now everything is a stub — room routing gets wired in here once
/// we have a RoomRegistry in AppState.
async fn on_client_msg(msg: ClientMsg, player_id: &str, state: &AppState) {
    tracing::debug!(player = %player_id, ?msg, "recv");

    match msg {
        ClientMsg::CreateRoom { bet_sats } => {
            let handle = state.rooms.create(bet_sats);
            let room_id = handle.id.to_string();

            if let Some(tx) = state.sessions.get_sender(player_id).await {
                handle.send(RoomCmd::PlayerJoin { player_id: player_id.to_string(), tx }).await;
            }

            state.sessions.send(player_id, ServerMsg::RoomCreated { room_id }).await;
        }

        ClientMsg::JoinRoom { room_id, bet_sats: _ } => {
            match state.rooms.get(&room_id) {
                Some(handle) => {
                    if let Some(tx) = state.sessions.get_sender(player_id).await {
                        handle.send(RoomCmd::PlayerJoin { player_id: player_id.to_string(), tx }).await;
                    }
                    state.sessions.send(player_id, ServerMsg::RoomJoined { room_id }).await;
                }
                None => {
                    state.sessions.send(
                        player_id,
                        ServerMsg::Error { message: format!("room '{}' not found", room_id) },
                    ).await;
                }
            }
        }

        ClientMsg::GameAction { action } => {
            // Will forward to the room actor once we track which room a player is in.
            tracing::debug!(player = %player_id, ?action, "game action (no-op until room tracking)");
        }
    }
}
