pub mod board;
pub mod input;
pub mod logic;
pub mod piece;
pub mod scoring;
pub mod session;
pub mod snapshot;

pub use board::{empty_board, Board, COLS, ROWS, VISIBLE_ROW_START};
pub use input::{try_move_left, try_move_right, try_rotate_cw, try_rotate_ccw, GameAction};
pub use logic::{clear_lines, is_valid, lock_piece, sonic_drop, tick_ms, try_move_down};
pub use piece::{ActivePiece, Piece, PieceQueue};
pub use session::{GameSession, PlayerUpdate, LOCK_DELAY_MS_BASE, LOCK_DELAY_MS_MIN, LOCK_RESET_MAX, LOOKAHEAD};
pub use snapshot::{OpponentSnapshot, PieceSnapshot, PlayerSnapshot};

// ── Lock delay state ──────────────────────────────────────────────────────────

/// Per-piece lock-delay state.
///
/// `reset_count` is per-piece (cleared only on spawn), not per-grounding —
/// resetting it on every airborne transition would let players farm resets.
#[derive(Debug, Clone, Default)]
pub struct LockState {
    deadline: Option<std::time::Instant>,
    reset_count: u8,
}

impl LockState {
    /// True if the lock deadline is currently running.
    pub fn is_active(&self) -> bool {
        self.deadline.is_some()
    }

    /// True if the deadline has expired.
    pub fn is_expired(&self) -> bool {
        self.deadline.map_or(false, |d| std::time::Instant::now() >= d)
    }

    /// Start the deadline when the piece first touches the ground.
    pub fn start(&mut self, delay_ms: u64) {
        self.deadline =
            Some(std::time::Instant::now() + std::time::Duration::from_millis(delay_ms));
    }

    /// Cancel the deadline because the piece became airborne again.
    /// Returns `true` if the deadline was active (useful for debug logging).
    /// Keeps `reset_count` intact — budget is per-piece, not per-grounding.
    pub fn cancel(&mut self) -> bool {
        self.deadline.take().is_some()
    }

    /// Try to reset the deadline after a successful move or rotate.
    /// Returns `true` if the reset budget is exhausted (caller should lock immediately).
    pub fn try_reset(&mut self, delay_ms: u64, max_resets: u8) -> bool {
        if self.reset_count >= max_resets {
            return true;
        }
        self.deadline =
            Some(std::time::Instant::now() + std::time::Duration::from_millis(delay_ms));
        self.reset_count += 1;
        false
    }

    /// How many resets have been used so far (for debug logging).
    pub fn reset_count(&self) -> u8 {
        self.reset_count
    }

    /// Full reset — call when a new piece spawns.
    pub fn clear(&mut self) {
        self.deadline = None;
        self.reset_count = 0;
    }
}

// ── PlayerGameState ───────────────────────────────────────────────────────────

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

    /// Lock-delay state for the current piece.
    pub lock: LockState,

    /// Number of consecutive piece locks that each cleared at least one line.
    /// Reset to 0 on any lock that clears zero lines.
    pub combo: u32,
    /// True if the last line clear was a Tetris (4 lines).
    /// Enables the back-to-back bonus on the next Tetris.
    pub back_to_back: bool,
}

impl PlayerGameState {
    /// Updates score, combo, back-to-back, lines cleared, and level after a lock.
    /// Returns the number of garbage lines to send to the opponent.
    pub fn apply_clear(&mut self, lines: u32) -> u32 {
        let pts = scoring::score_for_clear(lines, self.level, self.back_to_back, self.combo);
        self.score += pts;
        tracing::debug!(
            lines,
            pts,
            combo = self.combo,
            back_to_back = self.back_to_back,
            "apply_clear"
        );
        if lines > 0 {
            self.combo += 1;
            self.back_to_back = lines == 4;
        } else {
            self.combo = 0;
            self.back_to_back = false;
        }
        self.lines_cleared += lines;
        self.level = scoring::level_for_lines(self.lines_cleared);
        scoring::garbage_for_clear(lines, self.back_to_back)
    }

    /// `queue_index` must be the index of `next_piece` inside the shared queue.
    pub fn new(first_piece: Piece, next_piece: Piece, queue_index: usize) -> Self {
        Self {
            board: empty_board(),
            active_piece: Some(ActivePiece {
                kind: first_piece,
                row: VISIBLE_ROW_START as i8,
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
            lock: LockState::default(),
            combo: 0,
            back_to_back: false,
        }
    }
}
