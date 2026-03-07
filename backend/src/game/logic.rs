use super::{ActivePiece, Board, COLS, ROWS};

/// Returns the tick interval in milliseconds for a given level.
/// Formula: (0.8 - level * 0.007)^level * 1000, capped at 33ms.
pub fn tick_ms(level: u32) -> u64 {
    let l = level as f64;
    let ms = (0.8 - l * 0.007).powf(l) * 1000.0;
    (ms as u64).max(33)
}

/// Returns true if the piece can occupy its current position on the board.
pub fn is_valid(board: &Board, piece: &ActivePiece) -> bool {
    for (dr, dc) in piece.kind.cells(piece.rotation) {
        let r = piece.row + dr;
        let c = piece.col + dc;
        if c < 0 || c >= COLS as i8 || r >= ROWS as i8 {
            return false;
        }
        if r >= 0 && board[r as usize][c as usize] != 0 {
            return false;
        }
    }
    true
}

/// Attempts to move the active piece down by one row.
/// Returns the updated piece on success, or `None` if it would collide (time to lock).
pub fn try_move_down(board: &Board, piece: &ActivePiece) -> Option<ActivePiece> {
    let moved = ActivePiece {
        row: piece.row + 1,
        ..*piece
    };
    if is_valid(board, &moved) {
        Some(moved)
    } else {
        None
    }
}
