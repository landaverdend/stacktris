use serde::{Deserialize, Serialize};

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
    RoomCreated { room_id: String },

    /// Sent to the joining player on successful join.
    RoomJoined { room_id: String },

    /// Sent to the *waiting* player when the second player joins.
    PlayerJoined,

    /// Sent to both players when the room transitions to Countdown.
    GameStart { countdown: u32 },

    /// The main in-game update. Sent after every meaningful state change.
    GameState {
        your: PlayerSnapshot,
        opponent: OpponentSnapshot,
    },

    /// Sent to both players when the game ends.
    GameOver {
        winner_id: String,
        your_score: u64,
        opponent_score: u64,
    },

    Error { message: String },
}

/// Full state for the receiving player's own board.
#[derive(Debug, Clone, Serialize)]
pub struct PlayerSnapshot {
    pub board: Vec<Vec<Option<String>>>,
    pub current_piece: Option<PieceSnapshot>,
    pub next_pieces: Vec<String>,
    pub hold_piece: Option<String>,
    pub pending_garbage: u32,
    pub score: u64,
    pub lines: u32,
    pub level: u32,
}

/// Reduced state for the opponent — no piece queue info.
#[derive(Debug, Clone, Serialize)]
pub struct OpponentSnapshot {
    pub board: Vec<Vec<Option<String>>>,
    pub pending_garbage: u32,
    pub score: u64,
    pub lines: u32,
    pub level: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct PieceSnapshot {
    pub kind: String,
    pub col: i32,
    pub row: i32,
    pub rotation: u8,
}
