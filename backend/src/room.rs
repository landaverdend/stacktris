use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use tokio::sync::mpsc;
use tokio::time;
use uuid::Uuid;

use crate::game::{tick_ms, GameSession, PlayerGameState, TickEvent, VISIBLE_ROW_START};
use crate::protocol::{GameAction, OpponentSnapshot, PieceSnapshot, PlayerSnapshot, ServerMsg};

// ── Types ─────────────────────────────────────────────────────────────────────

pub type RoomId = Arc<str>;

// ── Phase ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum RoomPhase {
    Waiting,   // 1 player joined, waiting for opponent
    Playing,   // game loop active
    Done,      // game over, actor will exit
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

        let mut interval = time::interval(Duration::from_millis(tick_ms(0)));
        interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                Some(cmd) = self.rx.recv() => {
                    match cmd {
                        RoomCmd::PlayerJoin { player_id, tx } => self.on_join(player_id, tx).await,
                        RoomCmd::PlayerLeave { player_id } => self.on_leave(&player_id).await,
                        RoomCmd::PlayerInput { .. } => { /* TODO */ }
                    }
                }
                _ = interval.tick() => {
                    self.on_tick().await;
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
            let _ = tx.try_send(ServerMsg::Error { message: "Room is full".into() });
            return;
        }

        self.players.push(PlayerSlot { player_id: player_id.clone(), tx });
        tracing::info!(room = %self.id, player = %player_id, players = self.players.len(), "player joined");

        if self.players.len() == 2 {
            self.game = Some(GameSession::new());
            self.phase = RoomPhase::Playing;
            self.send_to(0, ServerMsg::PlayerJoined).await;
            self.broadcast(ServerMsg::GameStart { countdown: 3 }).await;
            self.broadcast_state().await;
        }
    }

    async fn on_tick(&mut self) {
        if self.phase != RoomPhase::Playing {
            return;
        }

        // Tick the game and collect what we need to send while `game` is borrowed.
        let outcome: Option<[TickEvent; 2]> = self.game.as_mut().map(|g| g.tick());
        let events = match outcome {
            Some(e) => e,
            None => return,
        };

        // Determine what to broadcast. For PieceMoved we only need the piece coords.
        // For PieceLocked we broadcast full state (done after this block).
        let mut needs_full_state = false;
        for (i, event) in events.iter().enumerate() {
            match event {
                TickEvent::PieceMoved => {
                    let msg = ServerMsg::PieceMoved {
                        your_piece: self.game.as_ref().map(|g| piece_snapshot(g.player(i))).flatten(),
                    };
                    let _ = self.players[i].tx.try_send(msg);
                }
                TickEvent::PieceLocked { .. } => {
                    needs_full_state = true;
                }
            }
        }

        if needs_full_state {
            self.broadcast_state().await;
        }
    }

    async fn on_leave(&mut self, player_id: &str) {
        self.players.retain(|p| p.player_id != player_id);
        tracing::info!(room = %self.id, player = %player_id, "player left");
        if self.players.is_empty() {
            self.phase = RoomPhase::Done;
        }
    }

    async fn broadcast_state(&self) {
        let game = match &self.game {
            Some(g) => g,
            None => return,
        };
        for (i, slot) in self.players.iter().enumerate() {
            let msg = ServerMsg::GameState {
                your: PlayerSnapshot::from(game.player(i)),
                opponent: OpponentSnapshot::from(game.player(1 - i)),
            };
            let _ = slot.tx.try_send(msg);
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

// ── Helpers ───────────────────────────────────────────────────────────────────

fn piece_snapshot(state: &PlayerGameState) -> Option<PieceSnapshot> {
    state.active_piece.map(|p| PieceSnapshot {
        kind: format!("{:?}", p.kind),
        row: p.row as i32 - VISIBLE_ROW_START as i32,
        col: p.col as i32,
        rotation: p.rotation,
    })
}

// ── Registry ──────────────────────────────────────────────────────────────────

pub struct RoomRegistry {
    rooms: DashMap<Arc<str>, RoomHandle>,
}

impl RoomRegistry {
    pub fn new() -> Self {
        Self { rooms: DashMap::new() }
    }

    pub fn create(&self, bet_sats: u64) -> RoomHandle {
        let id: RoomId = Uuid::new_v4().to_string().into();
        let (cmd_tx, cmd_rx) = mpsc::channel(32);

        let actor = RoomActor::new(id.clone(), bet_sats, cmd_rx);
        tokio::spawn(actor.run());

        let handle = RoomHandle { id: id.clone(), tx: cmd_tx };
        self.rooms.insert(id, handle.clone());
        handle
    }

    pub fn get(&self, room_id: &str) -> Option<RoomHandle> {
        self.rooms.get(room_id).map(|r| r.clone())
    }
}
