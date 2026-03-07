use super::{try_move_down, Piece, PlayerGameState};

pub enum TickEvent {
    PieceMoved,
    // PieceLocked { player: usize } — next
}

pub struct GameSession {
    players: [PlayerGameState; 2],
}

impl GameSession {
    pub fn new(p0: (Piece, Piece), p1: (Piece, Piece)) -> Self {
        Self {
            players: [
                PlayerGameState::new(p0.0, p0.1),
                PlayerGameState::new(p1.0, p1.1),
            ],
        }
    }

    /// Advance gravity for both players. Returns one TickEvent per player.
    pub fn tick(&mut self) -> [TickEvent; 2] {
        std::array::from_fn(|i| {
            let state = &mut self.players[i];
            if let Some(piece) = state.active_piece {
                state.active_piece = Some(
                    try_move_down(&state.board, &piece).unwrap_or(piece)
                    // TODO: on None → lock + spawn next
                );
            }
            TickEvent::PieceMoved
        })
    }

    pub fn player(&self, i: usize) -> &PlayerGameState {
        &self.players[i]
    }
}
