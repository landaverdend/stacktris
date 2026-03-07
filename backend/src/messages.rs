use serde::{Deserialize, Serialize};

use crate::game::GameRoom;

// ── Client → Server ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    GameAction { action: GameAction },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GameAction {
    MoveLeft,
    MoveRight,
    MoveDown,
    Rotate,
    HardDrop,
}

// ── Server → Client ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Sent to the first player while they wait for an opponent.
    WaitingForOpponent { room_id: String },
    /// Sent to both players when the room fills up.
    GameStart { room_id: String, countdown: u32 },
    /// Broadcast after every game action so both sides stay in sync.
    GameState { room: GameRoom },
    GameOver { winner_id: String },
    Error { message: String },
}
