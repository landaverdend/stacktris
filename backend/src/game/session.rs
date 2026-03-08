use super::{clear_lines, is_valid, lock_piece, try_move_down, ActivePiece, Piece, PieceQueue, PlayerGameState, VISIBLE_ROW_START};

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
                // Stamp piece onto board, clear full lines.
                lock_piece(&mut self.players[i].board, &piece);
                let lines_cleared = clear_lines(&mut self.players[i].board);

                // Advance queue pointer and fetch the next-next piece.
                self.players[i].queue_index += 1;
                let next_index = self.players[i].queue_index;
                let next_kind = self.players[i].next_piece;

                // Borrow queue independently from players (different fields).
                let upcoming = self.queue.get(next_index + 1);

                self.players[i].next_piece = upcoming;
                let new_active = spawn(next_kind, &self.players[i].board);
                self.players[i].active_piece = new_active;
                self.players[i].lines_cleared += lines_cleared;

                TickEvent::PieceLocked { lines_cleared }
            }
        }
    }

    pub fn player(&self, i: usize) -> &PlayerGameState {
        &self.players[i]
    }
}

fn spawn(kind: Piece, board: &super::Board) -> Option<ActivePiece> {
    let piece = ActivePiece {
        kind,
        row: VISIBLE_ROW_START as i8 - 2,
        col: kind.spawn_col(),
        rotation: 0,
    };
    if is_valid(board, &piece) { Some(piece) } else { None }
}
