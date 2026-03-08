use serde::{Deserialize, Serialize};

pub use crate::game::{OpponentSnapshot, PieceSnapshot, PlayerSnapshot};

// ── Client → Server ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    CreateRoom { bet_sats: u64 },
    JoinRoom { room_id: String, bet_sats: u64 },
    GameAction { action: GameAction },
}

/// Raw player inputs. The server buffers these and applies them on the next
/// game tick. Sending multiple per frame is fine (e.g. DAS repeat).
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GameAction {
    MoveLeft,
    MoveRight,
    RotateCw,
    RotateCcw,
    SoftDrop,
    HardDrop,
    Hold,
}

// ── Server → Client ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    /// Sent to the creator immediately after the room is created.
    RoomCreated {
        room_id: String,
    },

    /// Sent to the joining player on successful join.
    RoomJoined {
        room_id: String,
    },

    /// Sent to the *waiting* player when the second player joins.
    PlayerJoined,

    /// Sent to both players when the room transitions to Playing.
    GameStart {
        countdown: u32,
    },

    /// The main in-game update. Sent after every meaningful state change.
    GameState {
        your: PlayerSnapshot,
        opponent: OpponentSnapshot,
    },

    /// Sent every gravity tick when a piece moves down without locking.
    /// Much cheaper than a full GameState broadcast.
    PieceMoved {
        your_piece: Option<PieceSnapshot>,
    },

    /// Sent to both players when the game ends.
    GameOver {
        winner_id: String,
        your_score: u64,
        opponent_score: u64,
    },

    Error {
        message: String,
    },
}
