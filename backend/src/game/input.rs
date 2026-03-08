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

pub fn try_move_left(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let moved = ActivePiece {
        col: piece.col - 1,
        ..*piece
    };
    if is_valid(board, &moved) {
        Some(moved)
    } else {
        None
    }
}

pub fn try_move_right(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let moved = ActivePiece {
        col: piece.col + 1,
        ..*piece
    };
    if is_valid(board, &moved) {
        Some(moved)
    } else {
        None
    }
}

pub fn try_rotate_cw(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let to_rotation = (piece.rotation + 1) % 4;
    let kicks = piece.kind.kick_offsets(piece.rotation, true);
    try_with_kicks(board, piece, to_rotation, &kicks)
}

pub fn try_rotate_ccw(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let to_rotation = (piece.rotation + 3) % 4;
    let kicks = piece.kind.kick_offsets(piece.rotation, false);
    try_with_kicks(board, piece, to_rotation, &kicks)
}


/// The SRS system nudges each mino by the given offsets until a valid position is found.
fn try_with_kicks(
    board: &Board,
    piece: &ActivePiece,
    to_rotation: u8,
    kicks: &[(i8, i8); 5],
) -> Option<ActivePiece> {

    for &(dc, dr) in kicks {
        let candidate = ActivePiece {
            rotation: to_rotation,
            row: piece.row + dr,
            col: piece.col + dc,
            ..*piece
        };
        if is_valid(board, &candidate) {
            return Some(candidate);
        }
    }
    None
}
