use super::{
    clear_lines, is_valid, lock_piece, sonic_drop, try_move_down, try_move_left, try_move_right,
    try_rotate_ccw, try_rotate_cw, ActivePiece, GameAction, InputResult, OpponentSnapshot, Piece,
    PieceQueue, PlayerGameState, PlayerSnapshot, VISIBLE_ROW_START,
};

/// Number of upcoming pieces shown in the preview queue.
pub const LOOKAHEAD: usize = 5;

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
                self.players[i].active_piece = Some(moved);
                TickEvent::PieceMoved
            }
            None => {
                let lines_cleared = self.lock_and_advance(i, piece);
                TickEvent::PieceLocked { lines_cleared }
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
    }

    /// Applies a player input and returns the result, or `None` if the move
    /// was invalid (e.g. piece already at the wall).
    pub fn apply_input(&mut self, player_i: usize, action: GameAction) -> Option<InputResult> {
        let piece = self.players[player_i].active_piece?;
        let board = &self.players[player_i].board;

        match action {
            GameAction::MoveLeft => {
                self.players[player_i].active_piece = Some(try_move_left(board, &piece)?);
                Some(InputResult::PieceMoved)
            }
            GameAction::MoveRight => {
                self.players[player_i].active_piece = Some(try_move_right(board, &piece)?);
                Some(InputResult::PieceMoved)
            }
            GameAction::RotateCw => {
                self.players[player_i].active_piece = Some(try_rotate_cw(board, &piece)?);
                Some(InputResult::PieceMoved)
            }
            GameAction::RotateCcw => {
                self.players[player_i].active_piece = Some(try_rotate_ccw(board, &piece)?);
                Some(InputResult::PieceMoved)
            }
            GameAction::SoftDrop => {
                self.players[player_i].active_piece = Some(try_move_down(board, &piece)?);
                Some(InputResult::PieceMoved)
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

    fn lookahead(&mut self, player_i: usize, n: usize) -> Vec<Piece> {
        let start = self.players[player_i].queue_index;
        (start..start + n).map(|idx| self.queue.get(idx)).collect()
    }
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
