/// Total rows in the board: 20 visible + 20 hidden buffer above the ceiling.
/// Pieces spawn in the buffer; topping out into it ends the game.
pub const ROWS: usize = 40;
pub const COLS: usize = 10;
/// The first row that is visible to the player.
pub const VISIBLE_ROW_START: usize = 20;

/// 0 = empty cell; 1–7 = locked piece (see `Piece::cell_value`).
pub type Board = [[u8; COLS]; ROWS];

pub fn empty_board() -> Board {
    [[0; COLS]; ROWS]
}
