use super::{
    clear_lines, is_valid, lock_piece, try_move_down, ActivePiece, OpponentSnapshot, Piece,
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
                lock_piece(&mut self.players[i].board, &piece);
                let lines_cleared = clear_lines(&mut self.players[i].board);

                self.players[i].queue_index += 1;
                let next_index = self.players[i].queue_index;
                let next_kind = self.players[i].next_piece;

                let upcoming = self.queue.get(next_index + 1);

                self.players[i].next_piece = upcoming;
                let new_active = spawn(next_kind, &self.players[i].board);
                self.players[i].active_piece = new_active;
                self.players[i].lines_cleared += lines_cleared;

                TickEvent::PieceLocked { lines_cleared }
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
