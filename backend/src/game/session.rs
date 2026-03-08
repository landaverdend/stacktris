use super::{
    clear_lines, is_valid, lock_piece, sonic_drop, try_move_down, try_move_left, try_move_right,
    try_rotate_ccw, try_rotate_cw, ActivePiece, GameAction, InputResult, OpponentSnapshot, Piece,
    PieceQueue, PlayerGameState, PlayerSnapshot, VISIBLE_ROW_START,
};

/// Number of upcoming pieces shown in the preview queue.
pub const LOOKAHEAD: usize = 5;

/// Ticks a grounded piece waits before locking at level 0.
/// Decreases by 1 per level, flooring at `LOCK_TICKS_MIN`.
pub const LOCK_TICKS_BASE: u8 = 30;
/// Minimum lock delay ticks regardless of level.
pub const LOCK_TICKS_MIN: u8 = 5;
/// Maximum number of times a player can reset the lock timer per piece.
pub const LOCK_RESET_MAX: u8 = 15;

pub enum TickEvent {
    PieceMoved,
    PieceLocked { lines_cleared: u32 },
}

pub struct GameSession {
    players: [PlayerGameState; 2],
    queue: PieceQueue,
}

impl GameSession {
    pub fn new() -> Self {
        let mut queue = PieceQueue::new();
        // queue[0] = active piece, queue[1] = next piece — same for both players.
        // queue_index=1 means the player's current "next" slot is at index 1.
        let first = queue.get(0);
        let next = queue.get(1);
        let players = std::array::from_fn(|_| PlayerGameState::new(first, next, 1));
        Self { players, queue }
    }

    /// Advance gravity for both players. Returns one TickEvent per player.
    pub fn tick(&mut self) -> [TickEvent; 2] {
        [self.tick_player(0), self.tick_player(1)]
    }

    fn tick_player(&mut self, i: usize) -> TickEvent {
        let Some(piece) = self.players[i].active_piece else {
            return TickEvent::PieceMoved;
        };

        match try_move_down(&self.players[i].board, &piece) {
            Some(moved) => {
                // Piece is airborne — cancel the countdown but keep the reset count.
                // lock_reset_count is per-piece (cleared only on spawn), not per-grounding,
                // so it must NOT be reset here or players can kick airborne to farm resets.
                if self.players[i].lock_ticks_remaining > 0 {
                    tracing::debug!(
                        player = i,
                        resets_used = self.players[i].lock_reset_count,
                        "piece became airborne, lock timer cancelled"
                    );
                    self.players[i].lock_ticks_remaining = 0;
                }
                self.players[i].active_piece = Some(moved);
                TickEvent::PieceMoved
            }
            None => {
                // Piece is grounded — drive the lock delay countdown.
                if self.players[i].lock_ticks_remaining == 0 {
                    // First tick touching the ground: start the timer.
                    let ticks = lock_ticks_for_level(self.players[i].level);
                    self.players[i].lock_ticks_remaining = ticks;
                    tracing::debug!(
                        player = i,
                        ticks,
                        level = self.players[i].level,
                        "lock delay started"
                    );
                    TickEvent::PieceMoved
                } else {
                    self.players[i].lock_ticks_remaining -= 1;
                    tracing::debug!(
                        player = i,
                        ticks_remaining = self.players[i].lock_ticks_remaining,
                        "lock delay tick"
                    );
                    if self.players[i].lock_ticks_remaining == 0 {
                        tracing::debug!(player = i, "lock delay expired, locking piece");
                        let lines_cleared = self.lock_and_advance(i, piece);
                        TickEvent::PieceLocked { lines_cleared }
                    } else {
                        TickEvent::PieceMoved
                    }
                }
            }
        }
    }

    /// Lock `piece` onto player `i`'s board, clear lines, and advance the queue.
    fn lock_and_advance(&mut self, i: usize, piece: ActivePiece) -> u32 {
        lock_piece(&mut self.players[i].board, &piece);
        let lines_cleared = clear_lines(&mut self.players[i].board);

        self.players[i].queue_index += 1;
        let next_index = self.players[i].queue_index;
        let next_kind = self.players[i].next_piece;
        let upcoming = self.queue.get(next_index + 1);

        self.players[i].next_piece = upcoming;
        self.players[i].active_piece = spawn(next_kind, &self.players[i].board);
        self.players[i].lines_cleared += lines_cleared;
        self.players[i].hold_used = false;
        self.players[i].lock_ticks_remaining = 0;
        self.players[i].lock_reset_count = 0;
        self.compact_queue();

        lines_cleared
    }

    /// Consume the next piece from the queue as the new active piece.
    /// Used when hold is triggered with an empty hold slot.
    fn advance_from_queue(&mut self, i: usize) {
        let next_kind = self.players[i].next_piece;
        self.players[i].queue_index += 1;
        let next_index = self.players[i].queue_index;
        let upcoming = self.queue.get(next_index + 1);
        self.players[i].next_piece = upcoming;
        self.players[i].active_piece = spawn(next_kind, &self.players[i].board);
        self.players[i].lock_ticks_remaining = 0;
        self.players[i].lock_reset_count = 0;
        self.compact_queue();
    }

    /// Drop queue entries that neither player will ever read again.
    /// Drains the front of the shared queue and adjusts both players' indices.
    fn compact_queue(&mut self) {
        let drain = self.players[0].queue_index.min(self.players[1].queue_index);
        let drained = self.queue.compact(drain);
        self.players[0].queue_index -= drained;
        self.players[1].queue_index -= drained;
    }

    /// Applies a player input and returns the result, or `None` if the move
    /// was invalid (e.g. piece already at the wall).
    pub fn apply_input(&mut self, player_i: usize, action: GameAction) -> Option<InputResult> {
        let piece = self.players[player_i].active_piece?;
        let board = &self.players[player_i].board;

        match action {
            GameAction::MoveLeft => {
                let moved = try_move_left(board, &piece)?;
                self.players[player_i].active_piece = Some(moved);
                if self.try_lock_reset(player_i, &moved) {
                    let lines_cleared = self.lock_and_advance(player_i, moved);
                    return Some(InputResult::PieceLocked { lines_cleared });
                }
                Some(InputResult::PieceMoved)
            }
            GameAction::MoveRight => {
                let moved = try_move_right(board, &piece)?;
                self.players[player_i].active_piece = Some(moved);
                if self.try_lock_reset(player_i, &moved) {
                    let lines_cleared = self.lock_and_advance(player_i, moved);
                    return Some(InputResult::PieceLocked { lines_cleared });
                }
                Some(InputResult::PieceMoved)
            }
            GameAction::RotateCw => {
                let moved = try_rotate_cw(board, &piece)?;
                self.players[player_i].active_piece = Some(moved);
                if self.try_lock_reset(player_i, &moved) {
                    let lines_cleared = self.lock_and_advance(player_i, moved);
                    return Some(InputResult::PieceLocked { lines_cleared });
                }
                Some(InputResult::PieceMoved)
            }
            GameAction::RotateCcw => {
                let moved = try_rotate_ccw(board, &piece)?;
                self.players[player_i].active_piece = Some(moved);
                if self.try_lock_reset(player_i, &moved) {
                    let lines_cleared = self.lock_and_advance(player_i, moved);
                    return Some(InputResult::PieceLocked { lines_cleared });
                }
                Some(InputResult::PieceMoved)
            }
            GameAction::SoftDrop => {
                // Soft drop bypasses lock delay — if the piece can't move down it locks immediately.
                match try_move_down(board, &piece) {
                    Some(moved) => {
                        self.players[player_i].active_piece = Some(moved);
                        Some(InputResult::PieceMoved)
                    }
                    None => {
                        let lines_cleared = self.lock_and_advance(player_i, piece);
                        Some(InputResult::PieceLocked { lines_cleared })
                    }
                }
            }
            GameAction::HardDrop => {
                let landed = sonic_drop(board, &piece);
                let lines_cleared = self.lock_and_advance(player_i, landed);
                Some(InputResult::PieceLocked { lines_cleared })
            }
            GameAction::Hold => {
                if self.players[player_i].hold_used {
                    return None;
                }
                let current_kind = piece.kind;
                match self.players[player_i].hold_piece {
                    Some(held_kind) => {
                        // Swap current piece with the held piece.
                        let new_active = spawn(held_kind, &self.players[player_i].board)?;
                        self.players[player_i].active_piece = Some(new_active);
                        self.players[player_i].hold_piece = Some(current_kind);
                    }
                    None => {
                        // First hold — stash current piece, pull next from queue.
                        self.players[player_i].hold_piece = Some(current_kind);
                        self.players[player_i].active_piece = None; // clear before advance
                        self.advance_from_queue(player_i);
                        // advance_from_queue may fail to spawn (stack too high) — that's fine,
                        // active_piece will be None and game-over logic handles it later.
                    }
                }
                // New piece in play — reset lock state.
                self.players[player_i].lock_ticks_remaining = 0;
                self.players[player_i].lock_reset_count = 0;
                self.players[player_i].hold_used = true;
                Some(InputResult::StateChanged)
            }
        }
    }

    /// Builds a full `PlayerSnapshot` for player `i`, including the lookahead
    /// piece queue. This is the only place in the codebase that needs to know
    /// about both player state and the shared queue.
    pub fn player_snapshot(&mut self, i: usize) -> PlayerSnapshot {
        let next_pieces = self
            .lookahead(i, LOOKAHEAD)
            .iter()
            .map(|p| format!("{p:?}"))
            .collect();
        let mut snapshot = PlayerSnapshot::from(self.player(i));
        snapshot.next_pieces = next_pieces;
        snapshot
    }

    /// Builds an `OpponentSnapshot` for player `i`.
    pub fn opponent_snapshot(&self, i: usize) -> OpponentSnapshot {
        OpponentSnapshot::from(self.player(i))
    }

    pub fn player(&self, i: usize) -> &PlayerGameState {
        &self.players[i]
    }

    /// Returns the minimal data needed to build a `HoldUpdate` message.
    /// Returns `None` if the hold slot is somehow empty (shouldn't happen after a hold).
    pub fn hold_update_data(&mut self, i: usize) -> Option<(String, Option<ActivePiece>, Vec<String>)> {
        let hold_name = format!("{:?}", self.players[i].hold_piece?);
        let active = self.players[i].active_piece;
        let next_pieces = self.lookahead(i, LOOKAHEAD).iter().map(|p| format!("{p:?}")).collect();
        Some((hold_name, active, next_pieces))
    }

    fn lookahead(&mut self, player_i: usize, n: usize) -> Vec<Piece> {
        let start = self.players[player_i].queue_index;
        (start..start + n).map(|idx| self.queue.get(idx)).collect()
    }

    /// Handles lock delay after a successful move/rotate.
    /// Returns `true` if the caller should immediately lock the piece (budget exhausted).
    /// Returns `false` if the timer was reset normally or the piece is now airborne.
    fn try_lock_reset(&mut self, i: usize, moved: &ActivePiece) -> bool {
        // Timer not yet active — nothing to do until the first grounding tick.
        if self.players[i].lock_ticks_remaining == 0 {
            return false;
        }
        // Piece is now airborne — gravity tick will cancel the timer naturally.
        if try_move_down(&self.players[i].board, moved).is_some() {
            return false;
        }
        // Budget exhausted — signal caller to lock immediately.
        if self.players[i].lock_reset_count >= LOCK_RESET_MAX {
            tracing::debug!(
                player = i,
                "lock reset budget exhausted, locking immediately"
            );
            return true;
        }
        let ticks = lock_ticks_for_level(self.players[i].level);
        self.players[i].lock_ticks_remaining = ticks;
        self.players[i].lock_reset_count += 1;
        tracing::debug!(
            player = i,
            reset_count = self.players[i].lock_reset_count,
            ticks,
            "lock delay reset"
        );
        false
    }
}

/// Returns the lock delay in ticks for the given level.
/// Decreases by 1 tick per level, clamped to `LOCK_TICKS_MIN`.
fn lock_ticks_for_level(level: u32) -> u8 {
    LOCK_TICKS_BASE.saturating_sub(level as u8).max(LOCK_TICKS_MIN)
}

fn spawn(kind: Piece, board: &super::Board) -> Option<ActivePiece> {
    let piece = ActivePiece {
        kind,
        row: VISIBLE_ROW_START as i8 - 2,
        col: kind.spawn_col(),
        rotation: 0,
    };
    if is_valid(board, &piece) {
        Some(piece)
    } else {
        None
    }
}
