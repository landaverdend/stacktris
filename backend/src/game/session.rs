use std::time::{Duration, Instant};

use super::{
    clear_lines, is_valid, lock_piece, sonic_drop, try_move_down, try_move_left, try_move_right,
    try_rotate_ccw, try_rotate_cw, ActivePiece, Board, GameAction, OpponentSnapshot, Piece,
    PieceQueue, PieceSnapshot, PlayerGameState, PlayerSnapshot, VISIBLE_ROW_START,
};

/// Number of upcoming pieces shown in the preview queue.
pub const LOOKAHEAD: usize = 5;

/// Lock delay in milliseconds at level 0.
/// Independent of gravity — piece locks 500 ms after it touches the ground.
pub const LOCK_DELAY_MS_BASE: u64 = 300;
/// Minimum lock delay regardless of level.
pub const LOCK_DELAY_MS_MIN: u64 = 100;
/// Maximum number of times a player can reset the lock timer per piece.
pub const LOCK_RESET_MAX: u8 = 15;

/// How many seconds between each gravity level step.
pub const GRAVITY_STEP_SECS: u64 = 30;
/// Maximum gravity level (gravity can't increase beyond this).
pub const GRAVITY_LEVEL_MAX: u32 = 15;

pub enum PlayerUpdate {
    PieceMoved {
        piece: Option<PieceSnapshot>,
    },
    FullState {
        your: PlayerSnapshot,
        opponent: OpponentSnapshot,
    },
    HoldSwapped {
        hold_piece: String,
        your_piece: Option<PieceSnapshot>,
        next_pieces: Vec<String>,
    },
    /// Sent when only the score/lines/level/combo changed without a full board redraw.
    /// Currently emitted on soft drop moves.
    ScoreUpdate {
        score: u64,
        lines: u32,
        level: u32,
        combo: u32,
    },
}

enum TickEvent {
    PieceMoved,
    PieceLocked { lines_cleared: u32 },
}

pub struct GameSession {
    players: [PlayerGameState; 2],
    queue: PieceQueue,
    start_time: Instant,
    gravity_level: u32,
}

impl GameSession {
    pub fn new() -> Self {
        let mut queue = PieceQueue::new();
        // queue[0] = active piece, queue[1] = next piece — same for both players.
        // queue_index=1 means the player's current "next" slot is at index 1.
        let first = queue.get(0);
        let next = queue.get(1);
        let players = std::array::from_fn(|_| PlayerGameState::new(first, next, 1));
        Self { players, queue, start_time: Instant::now(), gravity_level: 0 }
    }

    /// Returns the current gravity tick interval in milliseconds, escalating every
    /// `GRAVITY_STEP_SECS` seconds up to `GRAVITY_LEVEL_MAX`. Call after each tick
    /// and recreate the interval if the value changed.
    pub fn gravity_tick_ms(&mut self) -> u64 {
        let elapsed = self.start_time.elapsed().as_secs();
        let new_level = ((elapsed / GRAVITY_STEP_SECS) as u32).min(GRAVITY_LEVEL_MAX);
        if new_level != self.gravity_level {
            tracing::info!(
                old_level = self.gravity_level,
                new_level,
                elapsed_secs = elapsed,
                "gravity level increased"
            );
            self.gravity_level = new_level;
        }
        super::tick_ms(self.gravity_level)
    }

    /// Advance gravity for both players. Returns one Vec<PlayerUpdate> per player.
    pub fn tick(&mut self) -> [Vec<PlayerUpdate>; 2] {
        let e0 = self.tick_player(0);
        let e1 = self.tick_player(1);
        let locked = matches!(e0, TickEvent::PieceLocked { .. })
            || matches!(e1, TickEvent::PieceLocked { .. });
        if locked {
            self.full_state_updates()
        } else {
            [
                vec![PlayerUpdate::PieceMoved {
                    piece: self.active_piece_snapshot(0),
                }],
                vec![PlayerUpdate::PieceMoved {
                    piece: self.active_piece_snapshot(1),
                }],
            ]
        }
    }

    fn tick_player(&mut self, i: usize) -> TickEvent {
        let Some(piece) = self.players[i].active_piece else {
            return TickEvent::PieceMoved;
        };

        match try_move_down(&self.players[i].board, &piece) {
            Some(moved) => {
                // Piece is airborne — cancel the deadline but keep the reset count.
                // lock_reset_count is per-piece (cleared only on spawn), not per-grounding,
                // so it must NOT be reset here or players can kick airborne to farm resets.
                if self.players[i].lock_deadline.take().is_some() {
                    tracing::debug!(
                        player = i,
                        resets_used = self.players[i].lock_reset_count,
                        "piece became airborne, lock deadline cancelled"
                    );
                }
                self.players[i].active_piece = Some(moved);
                TickEvent::PieceMoved
            }
            None => {
                // Piece is grounded — check or start the lock deadline.
                match self.players[i].lock_deadline {
                    None => {
                        let delay = lock_delay_ms_for_level(self.players[i].level);
                        self.players[i].lock_deadline =
                            Some(Instant::now() + Duration::from_millis(delay));
                        tracing::debug!(
                            player = i,
                            delay_ms = delay,
                            level = self.players[i].level,
                            "lock delay started"
                        );
                        TickEvent::PieceMoved
                    }
                    Some(deadline) => {
                        if Instant::now() >= deadline {
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
    }

    /// Lock `piece` onto player `i`'s board, clear lines, score, and spawn the next piece.
    fn lock_and_advance(&mut self, i: usize, piece: ActivePiece) -> u32 {
        lock_piece(&mut self.players[i].board, &piece);
        let lines = clear_lines(&mut self.players[i].board);
        let garbage = self.players[i].apply_clear(lines);
        self.players[1 - i].pending_garbage += garbage;
        self.spawn_next(i);
        lines
    }

    /// Advance the queue and spawn the next piece for player `i`.
    /// Resets all per-piece state (lock timers, hold flag).
    fn spawn_next(&mut self, i: usize) {
        let next_kind = self.players[i].next_piece;
        self.players[i].queue_index += 1;
        let upcoming = self.queue.get(self.players[i].queue_index + 1);
        self.players[i].next_piece = upcoming;
        self.players[i].active_piece = spawn(next_kind, &self.players[i].board);
        self.players[i].hold_used = false;
        self.players[i].lock_deadline = None;
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

    /// Applies a player input and returns per-player updates.
    pub fn apply_input(&mut self, player_i: usize, action: GameAction) -> [Vec<PlayerUpdate>; 2] {
        let Some(piece) = self.players[player_i].active_piece else {
            return [vec![], vec![]];
        };

        match action {
            GameAction::MoveLeft => self.apply_movement(player_i, piece, try_move_left),
            GameAction::MoveRight => self.apply_movement(player_i, piece, try_move_right),
            GameAction::RotateCw => self.apply_movement(player_i, piece, try_rotate_cw),
            GameAction::RotateCcw => self.apply_movement(player_i, piece, try_rotate_ccw),
            GameAction::SoftDrop => {
                // Soft drop bypasses lock delay — if the piece can't move down it locks immediately.
                let moved = {
                    let board = &self.players[player_i].board;
                    try_move_down(board, &piece)
                };
                match moved {
                    Some(moved) => {
                        self.players[player_i].active_piece = Some(moved);
                        // +1 point per row dropped.
                        let rows = (moved.row as i32 - piece.row as i32).max(0) as u64;
                        self.players[player_i].score += rows;
                        let mut updates = self.piece_moved_update(player_i);
                        updates[player_i].push(self.score_update(player_i));
                        updates
                    }
                    None => {
                        self.lock_and_advance(player_i, piece);
                        self.full_state_updates()
                    }
                }
            }
            GameAction::HardDrop => {
                let landed = {
                    let board = &self.players[player_i].board;
                    sonic_drop(board, &piece)
                };
                // +2 points per row dropped. Score is then included in the FullState.
                let rows = (landed.row as i32 - piece.row as i32).max(0) as u64;
                self.players[player_i].score += rows * 2;
                self.lock_and_advance(player_i, landed);
                self.full_state_updates()
            }
            GameAction::Hold => {
                if self.players[player_i].hold_used {
                    return [vec![], vec![]];
                }
                let current_kind = piece.kind;
                match self.players[player_i].hold_piece {
                    Some(held_kind) => {
                        // Swap current piece with the held piece.
                        let new_active = match spawn(held_kind, &self.players[player_i].board) {
                            Some(a) => a,
                            None => return [vec![], vec![]],
                        };
                        self.players[player_i].active_piece = Some(new_active);
                        self.players[player_i].hold_piece = Some(current_kind);
                    }
                    None => {
                        // First hold — stash current piece, pull next from queue.
                        self.players[player_i].hold_piece = Some(current_kind);
                        self.players[player_i].active_piece = None; // clear before spawn
                        self.spawn_next(player_i);
                        // advance_from_queue may fail to spawn (stack too high) — that's fine,
                        // active_piece will be None and game-over logic handles it later.
                    }
                }
                // New piece in play — reset lock state.
                self.players[player_i].lock_deadline = None;
                self.players[player_i].lock_reset_count = 0;
                self.players[player_i].hold_used = true;
                self.hold_update(player_i)
            }
        }
    }

    /// Builds a full `PlayerSnapshot` for player `i`, including the lookahead
    /// piece queue. This is the only place in the codebase that needs to know
    /// about both player state and the shared queue.
    fn player_snapshot(&mut self, i: usize) -> PlayerSnapshot {
        let next_pieces = self
            .lookahead(i, LOOKAHEAD)
            .iter()
            .map(|p| format!("{p:?}"))
            .collect();
        let mut snapshot = PlayerSnapshot::from(&self.players[i]);
        snapshot.next_pieces = next_pieces;
        snapshot.level = self.gravity_level;
        snapshot
    }

    /// Builds an `OpponentSnapshot` for player `i`.
    fn opponent_snapshot(&self, i: usize) -> OpponentSnapshot {
        OpponentSnapshot::from(&self.players[i])
    }

    /// Returns full-state updates for both players.
    pub fn full_state_updates(&mut self) -> [Vec<PlayerUpdate>; 2] {
        let snap0 = self.player_snapshot(0);
        let opp1 = self.opponent_snapshot(1);
        let snap1 = self.player_snapshot(1);
        let opp0 = self.opponent_snapshot(0);
        [
            vec![PlayerUpdate::FullState {
                your: snap0,
                opponent: opp1,
            }],
            vec![PlayerUpdate::FullState {
                your: snap1,
                opponent: opp0,
            }],
        ]
    }

    fn piece_moved_update(&self, player_i: usize) -> [Vec<PlayerUpdate>; 2] {
        let mut updates: [Vec<PlayerUpdate>; 2] = [vec![], vec![]];
        updates[player_i].push(PlayerUpdate::PieceMoved {
            piece: self.active_piece_snapshot(player_i),
        });
        updates
    }

    fn score_update(&self, player_i: usize) -> PlayerUpdate {
        let p = &self.players[player_i];
        PlayerUpdate::ScoreUpdate {
            score: p.score,
            lines: p.lines_cleared,
            level: self.gravity_level,
            combo: p.combo,
        }
    }

    fn hold_update(&mut self, player_i: usize) -> [Vec<PlayerUpdate>; 2] {
        let hold_piece = format!("{:?}", self.players[player_i].hold_piece.unwrap());
        let your_piece = self.active_piece_snapshot(player_i);
        let next_pieces = self
            .lookahead(player_i, LOOKAHEAD)
            .iter()
            .map(|p| format!("{p:?}"))
            .collect();
        let mut updates: [Vec<PlayerUpdate>; 2] = [vec![], vec![]];
        updates[player_i].push(PlayerUpdate::HoldSwapped {
            hold_piece,
            your_piece,
            next_pieces,
        });
        updates
    }

    /// Shared logic for move-left / move-right / rotate-cw / rotate-ccw.
    /// Applies `try_fn`, handles lock-reset, and returns the appropriate update.
    fn apply_movement(
        &mut self,
        player_i: usize,
        piece: ActivePiece,
        try_fn: impl Fn(&Board, &ActivePiece) -> Option<ActivePiece>,
    ) -> [Vec<PlayerUpdate>; 2] {
        let Some(moved) = try_fn(&self.players[player_i].board, &piece) else {
            return [vec![], vec![]];
        };
        self.players[player_i].active_piece = Some(moved);
        if self.try_lock_reset(player_i, &moved) {
            self.lock_and_advance(player_i, moved);
            return self.full_state_updates();
        }
        self.piece_moved_update(player_i)
    }

    fn active_piece_snapshot(&self, player_i: usize) -> Option<PieceSnapshot> {
        self.players[player_i].active_piece.map(|p| PieceSnapshot {
            kind: format!("{:?}", p.kind),
            row: p.row as i32 - VISIBLE_ROW_START as i32,
            col: p.col as i32,
            rotation: p.rotation,
        })
    }

    fn lookahead(&mut self, player_i: usize, n: usize) -> Vec<Piece> {
        let start = self.players[player_i].queue_index;
        (start..start + n).map(|idx| self.queue.get(idx)).collect()
    }

    /// Handles lock delay after a successful move/rotate.
    /// Returns `true` if the caller should immediately lock the piece (budget exhausted).
    /// Returns `false` if the timer was reset normally or the piece is now airborne.
    fn try_lock_reset(&mut self, i: usize, moved: &ActivePiece) -> bool {
        // Deadline not active — piece hasn't touched the ground yet via a tick.
        if self.players[i].lock_deadline.is_none() {
            return false;
        }
        // Piece is now airborne — gravity tick will cancel the deadline naturally.
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
        let delay = lock_delay_ms_for_level(self.players[i].level);
        self.players[i].lock_deadline = Some(Instant::now() + Duration::from_millis(delay));
        self.players[i].lock_reset_count += 1;
        tracing::debug!(
            player = i,
            reset_count = self.players[i].lock_reset_count,
            delay_ms = delay,
            "lock delay reset"
        );
        false
    }
}

/// Returns the lock delay in milliseconds for the given level.
/// Decreases by 20 ms per level, clamped to `LOCK_DELAY_MS_MIN`.
fn lock_delay_ms_for_level(level: u32) -> u64 {
    LOCK_DELAY_MS_BASE
        .saturating_sub(level as u64 * 20)
        .max(LOCK_DELAY_MS_MIN)
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
