use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use tokio::sync::mpsc;
use tokio::time;
use uuid::Uuid;

use crate::game::{tick_ms, try_move_down, Piece, PlayerGameState};
use crate::protocol::{GameAction, OpponentSnapshot, PieceSnapshot, PlayerSnapshot, ServerMsg};

// ── Types ─────────────────────────────────────────────────────────────────────

pub type RoomId = Arc<str>;

// ── Phase ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum RoomPhase {
    Waiting,   // 1 player joined, waiting for opponent
    Ready,     // 2 players joined (need to add a betting hook.)
    Countdown, // 3-2-1 before gameplay
    Playing,   // game loop active
    Done,      // game over, actor will exit
}

// ── Commands sent into the actor ──────────────────────────────────────────────

pub enum RoomCmd {
    PlayerJoin {
        player_id: String,
        /// Sender half of the player's outbound channel.
        /// The actor holds this to push ServerMsgs directly to each player's
        /// WS task without going through the SessionRegistry.
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

/// Cheap-to-clone reference to a running room actor.
/// Send `RoomCmd`s through this to communicate with the actor.
#[derive(Clone)]
pub struct RoomHandle {
    pub id: RoomId,
    tx: mpsc::Sender<RoomCmd>,
}

impl RoomHandle {
    pub async fn send(&self, cmd: RoomCmd) {
        // Silently ignore if the actor has already exited.
        let _ = self.tx.send(cmd).await;
    }
}

// ── Actor ─────────────────────────────────────────────────────────────────────

struct PlayerSlot {
    player_id: String,
    tx: mpsc::Sender<ServerMsg>,
    state: PlayerGameState,
}

struct RoomActor {
    id: RoomId,
    phase: RoomPhase,
    bet_sats: u64,
    players: Vec<PlayerSlot>,
    rx: mpsc::Receiver<RoomCmd>,
}

impl RoomActor {
    fn new(id: RoomId, bet_sats: u64, rx: mpsc::Receiver<RoomCmd>) -> Self {
        Self {
            id,
            phase: RoomPhase::Waiting,
            bet_sats,
            players: Vec::with_capacity(2),
            rx,
        }
    }

    pub async fn run(mut self) {
        tracing::info!(room = %self.id, bet_sats = self.bet_sats, "actor started");

        // Tick interval — only fires when Playing. We start it here but it's
        // gated by the phase check inside on_tick, so early ticks are no-ops.
        let mut interval = time::interval(Duration::from_millis(tick_ms(0)));
        interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                Some(cmd) = self.rx.recv() => {
                    match cmd {
                        RoomCmd::PlayerJoin { player_id, tx } => self.on_join(player_id, tx).await,
                        RoomCmd::PlayerLeave { player_id } => self.on_leave(&player_id).await,
                        RoomCmd::PlayerInput { .. } => { /* wired up next */ }
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
            let _ = tx.try_send(ServerMsg::Error {
                message: "Room is full".into(),
            });
            return;
        }

        // TODO: replace with a proper random-bag piece generator
        let first_piece = Piece::T;
        let next_piece = Piece::I;

        self.players.push(PlayerSlot {
            player_id: player_id.clone(),
            tx,
            state: PlayerGameState::new(first_piece, next_piece),
        });
        tracing::info!(room = %self.id, player = %player_id, players = self.players.len(), "player joined");

        if self.players.len() == 2 {
            self.phase = RoomPhase::Ready;
            self.send_to(0, ServerMsg::PlayerJoined).await;
            self.phase = RoomPhase::Playing;
            self.broadcast(ServerMsg::GameStart { countdown: 3 }).await;
            self.broadcast_state().await;
        }
    }

    async fn on_tick(&mut self) {
        if self.phase != RoomPhase::Playing {
            return;
        }

        // Try to move each player's piece down one row.
        for slot in self.players.iter_mut() {
            if let Some(piece) = &slot.state.active_piece {
                slot.state.active_piece = Some(
                    try_move_down(&slot.state.board, piece).unwrap_or(*piece)
                    // TODO: on None → lock piece, spawn next (line clear phase)
                );
            }
        }

        // Build and send PieceMoved to each player (your piece + opponent piece).
        for slot in &self.players {
            let msg = ServerMsg::PieceMoved {
                your_piece: piece_snapshot(&slot.state),
            };
            let _ = slot.tx.try_send(msg);
        }
    }

    async fn on_leave(&mut self, player_id: &str) {
        self.players.retain(|p| p.player_id != player_id);
        tracing::info!(room = %self.id, player = %player_id, "player left");

        if self.players.is_empty() {
            self.phase = RoomPhase::Done;
        }
    }

    /// Sends each player their own full snapshot and the opponent's reduced snapshot.
    /// Player 0 sees: your=0, opponent=1. Player 1 sees: your=1, opponent=0.
    async fn broadcast_state(&self) {
        if self.players.len() != 2 {
            return;
        }
        for (i, slot) in self.players.iter().enumerate() {
            let other = &self.players[1 - i];
            let msg = ServerMsg::GameState {
                your: PlayerSnapshot::from(&slot.state),
                opponent: OpponentSnapshot::from(&other.state),
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
        row: p.row as i32 - crate::game::VISIBLE_ROW_START as i32,
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
        Self {
            rooms: DashMap::new(),
        }
    }

    /// Spawn a new room actor and return a handle to it.
    /// The caller is responsible for immediately sending a `PlayerJoin` so the
    /// creating player becomes the first occupant.
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
