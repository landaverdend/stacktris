use serde::Deserialize;

use super::{is_valid, ActivePiece, Board};

/// Raw player inputs sent from the client.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GameAction {
    MoveLeft,
    MoveRight,
    RotateCw,
    RotateCcw,
    SoftDrop,
    HardDrop,
    Hold,
}

/// Result of applying a player input.
pub enum InputResult {
    PieceMoved,
}

pub fn try_move_left(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let moved = ActivePiece { col: piece.col - 1, ..*piece };
    if is_valid(board, &moved) { Some(moved) } else { None }
}

pub fn try_move_right(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let moved = ActivePiece { col: piece.col + 1, ..*piece };
    if is_valid(board, &moved) { Some(moved) } else { None }
}
