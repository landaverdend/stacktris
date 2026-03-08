use super::{empty_board, ActivePiece, Board, COLS, ROWS};

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

/// Stamps the active piece onto the board, writing its piece type value into
/// each occupied cell. Call this when the piece can no longer move down.
pub fn lock_piece(board: &mut Board, piece: &ActivePiece) {
    for (dr, dc) in piece.kind.cells(piece.rotation) {
        let r = piece.row + dr;
        let c = piece.col + dc;
        if r >= 0 && r < ROWS as i8 && c >= 0 && c < COLS as i8 {
            board[r as usize][c as usize] = piece.kind as u8;
        }
    }
}

/// Removes any full rows from the board and shifts remaining rows down.
/// Returns the number of lines cleared.
pub fn clear_lines(board: &mut Board) -> u32 {
    let mut new_board: Board = empty_board();
    let mut write = ROWS - 1;
    let mut cleared = 0u32;

    for r in (0..ROWS).rev() {
        if board[r].contains(&0) {
            new_board[write] = board[r];
            write = write.saturating_sub(1);
        } else {
            cleared += 1;
        }
    }
    *board = new_board;
    cleared
}
