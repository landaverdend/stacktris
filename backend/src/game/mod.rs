pub mod board;
pub mod piece;

pub use board::{empty_board, Board, COLS, ROWS, VISIBLE_ROW_START};
pub use piece::{ActivePiece, Piece};

#[derive(Debug, Clone)]
pub struct PlayerGameState {
    pub board: Board,
    pub active_piece: Option<ActivePiece>,
    pub next_piece: Piece,
    pub score: u64,
    pub lines_cleared: u32,
    pub level: u32,
    /// Garbage lines queued to be sent to this player's board on next lock.
    pub pending_garbage: u32,
    pub game_over: bool,
}

impl PlayerGameState {
    pub fn new(first_piece: Piece, next_piece: Piece) -> Self {
        Self {
            board: empty_board(),
            active_piece: Some(ActivePiece {
                kind: first_piece,
                row: VISIBLE_ROW_START as i8 - 2,
                col: first_piece.spawn_col(),
                rotation: 0,
            }),
            next_piece,
            score: 0,
            lines_cleared: 0,
            level: 0,
            pending_garbage: 0,
            game_over: false,
        }
    }
}
