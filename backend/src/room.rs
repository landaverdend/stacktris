use std::sync::Arc;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use tokio::sync::mpsc;
use tokio::time;
use uuid::Uuid;

use crate::game::{tick_ms, GameSession, PlayerUpdate, SessionOutcome};
use crate::protocol::{GameAction, ServerMsg};

// ── Types ─────────────────────────────────────────────────────────────────────

pub type RoomId = Arc<str>;

impl From<PlayerUpdate> for ServerMsg {
    fn from(u: PlayerUpdate) -> Self {
        match u {
            PlayerUpdate::PieceMoved { piece } => ServerMsg::PieceMoved { your_piece: piece },
            PlayerUpdate::FullState { your, opponent } => ServerMsg::GameState { your, opponent },
            PlayerUpdate::HoldSwapped {
                hold_piece,
                your_piece,
                next_pieces,
            } => ServerMsg::HoldUpdate {
                hold_piece,
                your_piece,
                next_pieces,
            },
            PlayerUpdate::ScoreUpdate {
                score,
                lines,
                level,
                combo,
            } => ServerMsg::ScoreUpdate {
                score,
                lines,
                level,
                combo,
            },
        }
    }
}

// ── Phase ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum RoomPhase {
    Waiting,                    // 1 player joined, waiting for opponent
    CountingDown(Instant),      // both players joined, countdown before game starts
    Playing,                    // game loop active
    Done,                       // game over, actor will exit
}

// ── Commands sent into the actor ──────────────────────────────────────────────

pub enum RoomCmd {
    PlayerJoin {
        player_id: String,
        tx: mpsc::Sender<ServerMsg>,
    },
    PlayerLeave {
        player_id: String,
    },
    PlayerInput {
        player_id: String,
        action: GameAction,
    },
}

// ── Handle ────────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct RoomHandle {
    pub id: RoomId,
    tx: mpsc::Sender<RoomCmd>,
}

impl RoomHandle {
    pub async fn send(&self, cmd: RoomCmd) {
        let _ = self.tx.send(cmd).await;
    }
}

// ── Actor ─────────────────────────────────────────────────────────────────────

struct PlayerSlot {
    player_id: String,
    tx: mpsc::Sender<ServerMsg>,
}

struct RoomActor {
    id: RoomId,
    phase: RoomPhase,
    bet_sats: u64,
    players: Vec<PlayerSlot>,
    game: Option<GameSession>,
    rx: mpsc::Receiver<RoomCmd>,
}

impl RoomActor {
    fn new(id: RoomId, bet_sats: u64, rx: mpsc::Receiver<RoomCmd>) -> Self {
        Self {
            id,
            phase: RoomPhase::Waiting,
            bet_sats,
            players: Vec::with_capacity(2),
            game: None,
            rx,
        }
    }

    pub async fn run(mut self) {
        tracing::info!(room = %self.id, bet_sats = self.bet_sats, "actor started");

        let initial_ms = tick_ms(0);
        let mut current_tick_ms = initial_ms;
        let mut interval = time::interval(Duration::from_millis(initial_ms));
        interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                Some(cmd) = self.rx.recv() => {
                    match cmd {
                        RoomCmd::PlayerJoin { player_id, tx } => self.on_join(player_id, tx).await,
                        RoomCmd::PlayerLeave { player_id } => self.on_leave(&player_id).await,
                        RoomCmd::PlayerInput { player_id, action } => self.on_input(&player_id, action).await,
                    }
                }
                _ = interval.tick() => {
                    self.on_tick().await;
                    // Check if gravity escalated and recreate the interval if so.
                    if let Some(game) = self.game.as_mut() {
                        let new_ms = game.gravity_tick_ms();
                        if new_ms != current_tick_ms {
                            current_tick_ms = new_ms;
                            interval = time::interval(Duration::from_millis(new_ms));
                            interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);
                        }
                    }
                }
            }

            if self.phase == RoomPhase::Done {
                break;
            }
        }

        tracing::info!(room = %self.id, "actor stopped");
    }

    async fn on_join(&mut self, player_id: String, tx: mpsc::Sender<ServerMsg>) {
        if self.players.len() >= 2 {
            let _ = tx.try_send(ServerMsg::Error {
                message: "Room is full".into(),
            });
            return;
        }

        self.players.push(PlayerSlot {
            player_id: player_id.clone(),
            tx,
        });
        tracing::info!(room = %self.id, player = %player_id, players = self.players.len(), "player joined");

        if self.players.len() == 2 {
            self.game = Some(GameSession::new());
            self.send_to(0, ServerMsg::PlayerJoined).await;
            self.broadcast(ServerMsg::GameStart { countdown: 3 }).await;
            self.phase = RoomPhase::CountingDown(Instant::now() + Duration::from_secs(3));
        }
    }

    async fn on_tick(&mut self) {
        // Countdown phase: transition to Playing once the deadline passes.
        if let RoomPhase::CountingDown(deadline) = self.phase {
            if Instant::now() >= deadline {
                self.phase = RoomPhase::Playing;
                self.broadcast_state().await;
                tracing::info!(room = %self.id, "countdown finished, game started");
            }
            return;
        }

        if self.phase != RoomPhase::Playing {
            return;
        }
        let outcome = match self.game.as_mut() {
            Some(g) => g.tick(),
            None => return,
        };
        self.handle_outcome(outcome).await;
    }

    async fn on_input(&mut self, player_id: &str, action: GameAction) {
        if !matches!(self.phase, RoomPhase::Playing) {
            return;
        }
        let Some(player_i) = self.players.iter().position(|p| p.player_id == player_id) else {
            return;
        };
        let outcome = match self.game.as_mut() {
            Some(g) => g.apply_input(player_i, action),
            None => return,
        };
        self.handle_outcome(outcome).await;
    }

    async fn handle_outcome(&mut self, outcome: SessionOutcome) {
        match outcome {
            SessionOutcome::Continue(updates) => self.dispatch(updates).await,
            SessionOutcome::GameOver { winner_i } => {
                let scores = self.game.as_ref().map(|g| g.scores()).unwrap_or([0, 0]);
                let winner_id = self
                    .players
                    .get(winner_i)
                    .map(|s| s.player_id.clone())
                    .unwrap_or_default();
                tracing::info!(room = %self.id, winner = %winner_id, "game over");
                for (slot_i, slot) in self.players.iter().enumerate() {
                    let _ = slot.tx.try_send(ServerMsg::GameOver {
                        winner_id: winner_id.clone(),
                        you_won: slot_i == winner_i,
                        your_score: scores[slot_i],
                        opponent_score: scores[1 - slot_i],
                    });
                }
                self.phase = RoomPhase::Done;
            }
        }
    }

    async fn on_leave(&mut self, player_id: &str) {
        tracing::info!(room = %self.id, player = %player_id, "player left");

        if matches!(self.phase, RoomPhase::Playing | RoomPhase::CountingDown(_)) {
            // Find the leaver's game index before removing them.
            let leaver_i = self.players.iter().position(|p| p.player_id == player_id);
            self.players.retain(|p| p.player_id != player_id);

            if let (Some(li), Some(winner_slot)) = (leaver_i, self.players.first()) {
                let winner_i = 1 - li;
                let scores = self.game.as_ref().map(|g| g.scores()).unwrap_or([0, 0]);
                let winner_id = winner_slot.player_id.clone();
                tracing::info!(room = %self.id, winner = %winner_id, "forfeit win");
                let _ = winner_slot.tx.try_send(ServerMsg::GameOver {
                    winner_id,
                    you_won: true,
                    your_score: scores[winner_i],
                    opponent_score: scores[li],
                });
            }
            self.phase = RoomPhase::Done;
            return;
        }

        self.players.retain(|p| p.player_id != player_id);
        if self.players.is_empty() {
            self.phase = RoomPhase::Done;
        }
    }

    async fn broadcast_state(&mut self) {
        let updates = match self.game.as_mut() {
            Some(g) => g.full_state_updates(),
            None => return,
        };
        self.dispatch(updates).await;
    }

    /// Send each player their respective Vec of updates in order.
    async fn dispatch(&self, updates: [Vec<crate::game::PlayerUpdate>; 2]) {
        for (i, player_updates) in updates.into_iter().enumerate() {
            if let Some(slot) = self.players.get(i) {
                for update in player_updates {
                    let _ = slot.tx.try_send(ServerMsg::from(update));
                }
            }
        }
    }

    async fn broadcast(&self, msg: ServerMsg) {
        for slot in &self.players {
            let _ = slot.tx.try_send(msg.clone());
        }
    }

    async fn send_to(&self, index: usize, msg: ServerMsg) {
        if let Some(slot) = self.players.get(index) {
            let _ = slot.tx.try_send(msg);
        }
    }
}

// ── Registry ──────────────────────────────────────────────────────────────────

pub struct RoomRegistry {
    rooms: DashMap<Arc<str>, RoomHandle>,
}

impl RoomRegistry {
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    pub fn create(&self, bet_sats: u64) -> RoomHandle {
        let id: RoomId = Uuid::new_v4().to_string().into();
        let (cmd_tx, cmd_rx) = mpsc::channel(32);

        let actor = RoomActor::new(id.clone(), bet_sats, cmd_rx);
        tokio::spawn(actor.run());

        let handle = RoomHandle {
            id: id.clone(),
            tx: cmd_tx,
        };
        self.rooms.insert(id, handle.clone());
        handle
    }

    pub fn get(&self, room_id: &str) -> Option<RoomHandle> {
        self.rooms.get(room_id).map(|r| r.clone())
    }
}
