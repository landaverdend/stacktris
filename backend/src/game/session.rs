use super::{try_move_down, PieceBag, PlayerGameState};

pub enum TickEvent {
    PieceMoved,
    // PieceLocked — next
}

pub struct GameSession {
    players: [PlayerGameState; 2],
    bag: PieceBag,
}

impl GameSession {
    pub fn new() -> Self {
        let mut bag = PieceBag::new();
        let first = bag.next();
        let next = bag.next();
        // Both players start with the same piece sequence for fairness.
        let players = std::array::from_fn(|_| PlayerGameState::new(first, next));
        Self { players, bag }
    }

    /// Advance gravity for both players. Returns one TickEvent per player.
    pub fn tick(&mut self) -> [TickEvent; 2] {
        std::array::from_fn(|i| {
            let state = &mut self.players[i];
            if let Some(piece) = state.active_piece {
                state.active_piece = Some(
                    try_move_down(&state.board, &piece).unwrap_or(piece)
                    // TODO: on None → lock + self.bag.next() (same draw for both players)
                );
            }
            TickEvent::PieceMoved
        })
    }

    pub fn player(&self, i: usize) -> &PlayerGameState {
        &self.players[i]
    }
}
