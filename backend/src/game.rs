use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GamePhase {
    Waiting,
    Countdown,
    Playing,
    GameOver,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub id: String,
    pub board: Vec<Vec<Option<String>>>,
    pub score: u64,
    pub lines: u32,
    pub level: u32,
    pub is_game_over: bool,
}

impl GameState {
    pub fn new(id: String) -> Self {
        Self {
            id,
            board: vec![vec![None; 10]; 20],
            score: 0,
            lines: 0,
            level: 0,
            is_game_over: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRoom {
    pub id: String,
    pub players: Vec<GameState>,
    pub phase: GamePhase,
    pub bet_amount_sats: u64,
    pub winner_id: Option<String>,
}

impl GameRoom {
    pub fn new(bet_amount_sats: u64) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            players: vec![],
            phase: GamePhase::Waiting,
            bet_amount_sats,
            winner_id: None,
        }
    }

    pub fn add_player(&mut self, player_id: String) -> bool {
        if self.players.len() >= 2 {
            return false;
        }
        self.players.push(GameState::new(player_id));
        true
    }

    pub fn is_full(&self) -> bool {
        self.players.len() >= 2
    }
}

pub struct GameRegistry {
    rooms: DashMap<String, GameRoom>,
}

impl GameRegistry {
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    pub fn create_room(&self, bet_amount_sats: u64) -> String {
        let room = GameRoom::new(bet_amount_sats);
        let id = room.id.clone();
        tracing::info!("Created room: {}", id);

        self.rooms.insert(id.clone(), room);
        id
    }

    pub fn get_room(&self, room_id: &str) -> Option<GameRoom> {
        self.rooms.get(room_id).map(|r| r.clone())
    }

    pub fn join_room(&self, room_id: &str, player_id: String) -> Result<(), &'static str> {
        let mut room = self.rooms.get_mut(room_id).ok_or("Room not found")?;
        if !room.add_player(player_id) {
            return Err("Room is full");
        }
        Ok(())
    }

    pub fn start_game(&self, room_id: &str) {
        if let Some(mut room) = self.rooms.get_mut(room_id) {
            room.phase = GamePhase::Playing;
        }
    }
}
