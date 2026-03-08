use serde::Serialize;

use super::{Board, PlayerGameState, ROWS, VISIBLE_ROW_START};

/// Full state snapshot for the receiving player's own board.
#[derive(Debug, Clone, Serialize)]
pub struct PlayerSnapshot {
    /// 20 visible rows × 10 cols. 0 = empty, 1–7 = locked piece type.
    pub board: Vec<Vec<u8>>,
    pub current_piece: Option<PieceSnapshot>,
    pub next_pieces: Vec<String>,
    pub hold_piece: Option<String>,
    pub hold_used: bool,
    pub pending_garbage: u32,
    pub score: u64,
    pub lines: u32,
    pub level: u32,
}

/// Reduced snapshot for the opponent — no piece queue info.
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
    /// True while the lock-delay countdown is running for this piece.
    pub lock_active: bool,
}

impl From<&PlayerGameState> for PlayerSnapshot {
    fn from(s: &PlayerGameState) -> Self {
        PlayerSnapshot {
            board: board_to_wire(&s.board),
            current_piece: s.active_piece.map(|p| PieceSnapshot {
                kind: format!("{:?}", p.kind),
                row: p.row as i32 - VISIBLE_ROW_START as i32,
                col: p.col as i32,
                rotation: p.rotation,
                lock_active: s.lock.is_active(),
            }),
            // Populated with the full lookahead by GameSession::player_snapshot;
            // the From impl alone only has access to next_piece.
            next_pieces: vec![format!("{:?}", s.next_piece)],
            hold_piece: s.hold_piece.map(|p| format!("{p:?}")),
            hold_used: s.hold_used,
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

pub(super) fn board_to_wire(board: &Board) -> Vec<Vec<u8>> {
    board[VISIBLE_ROW_START..ROWS]
        .iter()
        .map(|row| row.to_vec())
        .collect()
}
