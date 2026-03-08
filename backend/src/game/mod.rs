pub mod board;
pub mod input;
pub mod logic;
pub mod piece;
pub mod session;
pub mod snapshot;

pub use board::{empty_board, Board, COLS, ROWS, VISIBLE_ROW_START};
pub use input::{try_move_left, try_move_right, try_rotate_cw, try_rotate_ccw, GameAction, InputResult};
pub use logic::{clear_lines, is_valid, lock_piece, sonic_drop, tick_ms, try_move_down};
pub use piece::{ActivePiece, Piece, PieceQueue};
pub use session::{GameSession, TickEvent};
pub use snapshot::{OpponentSnapshot, PieceSnapshot, PlayerSnapshot};

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

    /// Index into the shared PieceQueue pointing at the current `next_piece`.
    /// Incremented on every lock to advance to the following piece.
    pub queue_index: usize,

    /// The piece currently stored in the hold slot, if any.
    pub hold_piece: Option<Piece>,
    /// True after hold has been used for the current active piece.
    /// Reset to false each time a new piece spawns.
    pub hold_used: bool,
}

impl PlayerGameState {
    /// `queue_index` must be the index of `next_piece` inside the shared queue.
    pub fn new(first_piece: Piece, next_piece: Piece, queue_index: usize) -> Self {
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
            queue_index,
            hold_piece: None,
            hold_used: false,
        }
    }
}
