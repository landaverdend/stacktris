use serde::{Deserialize, Serialize};

use crate::game::{Board, PlayerGameState, ROWS, VISIBLE_ROW_START};

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

    /// Sent to both players when the room transitions to Countdown.
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

/// Full state for the receiving player's own board.
#[derive(Debug, Clone, Serialize)]
pub struct PlayerSnapshot {
    /// 20 visible rows × 10 cols. 0 = empty, 1–7 = locked piece type (matches `Piece as u8`).
    pub board: Vec<Vec<u8>>,
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
    pub board: Vec<Vec<u8>>,
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

// ── Snapshot builders ─────────────────────────────────────────────────────────

impl From<&PlayerGameState> for PlayerSnapshot {
    fn from(s: &PlayerGameState) -> Self {
        PlayerSnapshot {
            board: board_to_wire(&s.board),
            current_piece: s.active_piece.map(|p| PieceSnapshot {
                kind: format!("{:?}", p.kind),
                // Row/col are in absolute board coordinates; subtract the hidden
                // buffer so the client works in visible-row space (0 = top of screen).
                row: p.row as i32 - VISIBLE_ROW_START as i32,
                col: p.col as i32,
                rotation: p.rotation,
            }),
            next_pieces: vec![format!("{:?}", s.next_piece)],
            hold_piece: None, // TODO: add hold_piece field to PlayerGameState
            pending_garbage: s.pending_garbage,
            score: s.score,
            lines: s.lines_cleared,
            level: s.level,
        }
    }
}

impl From<&PlayerGameState> for OpponentSnapshot {
    fn from(s: &PlayerGameState) -> Self {
        OpponentSnapshot {
            board: board_to_wire(&s.board),
            pending_garbage: s.pending_garbage,
            score: s.score,
            lines: s.lines_cleared,
            level: s.level,
        }
    }
}

/// Converts the internal board (all 40 rows) to the 20 visible rows the
/// client cares about. Each cell is None (empty) or Some("I") etc.
fn board_to_wire(board: &Board) -> Vec<Vec<u8>> {
    board[VISIBLE_ROW_START..ROWS]
        .iter()
        .map(|row| row.to_vec())
        .collect()
}
