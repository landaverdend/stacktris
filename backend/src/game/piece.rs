use serde::{Deserialize, Serialize};

/// The seven standard tetrominoes.
/// Values start at 1 — 0 is reserved for empty cells in `Board`.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[repr(u8)]
pub enum Piece {
    I = 1,
    O = 2,
    T = 3,
    S = 4,
    Z = 5,
    J = 6,
    L = 7,
}

impl Piece {
    /// Four (row, col) offsets that make up this piece at the given rotation (0–3).
    /// Offsets are relative to the piece's (row, col) anchor on the board.
    pub fn cells(self, rotation: u8) -> [(i8, i8); 4] {
        SHAPES[self as usize - 1][rotation as usize % 4]
    }

    /// Spawn column for this piece (left edge of bounding box).
    /// Centers the piece on a 10-wide board.
    pub fn spawn_col(self) -> i8 {
        match self {
            Piece::O => 4, // 2-wide piece, col 4 centres it
            _ => 3,        // 3- or 4-wide pieces
        }
    }
}

/// The falling piece currently in play.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ActivePiece {
    pub kind: Piece,
    /// Row of the top-left corner of the piece's bounding box.
    pub row: i8,
    /// Column of the top-left corner of the piece's bounding box.
    pub col: i8,
    pub rotation: u8,
}

impl ActivePiece {
    /// Absolute (row, col) board positions this piece currently occupies.
    pub fn board_cells(self) -> [(i8, i8); 4] {
        self.kind
            .cells(self.rotation)
            .map(|(dr, dc)| (self.row + dr, self.col + dc))
    }
}

// ── Shape tables ─────────────────────────────────────────────────────────────
// Layout: SHAPES[piece as usize - 1][rotation] = four (row, col) offsets
// Piece order matches the Piece enum: I O T S Z J L
//
// Reading each rotation visually (X = filled cell):
//   Rot 0 → Rot 1 → Rot 2 → Rot 3 each turn 90° clockwise.

#[rustfmt::skip]
const SHAPES: [[[(i8, i8); 4]; 4]; 7] = [
    // ── I ────────────────────────────────────────────────────────────────────
    // Rot 0:  Rot 1:  Rot 2:  Rot 3:
    //  ....    ..X.    ....    .X..
    //  XXXX    ..X.    XXXX    .X..
    //  ....    ..X.    ....    .X..
    //  ....    ..X.    ....    .X..
    [
        [(1,0),(1,1),(1,2),(1,3)],
        [(0,2),(1,2),(2,2),(3,2)],
        [(2,0),(2,1),(2,2),(2,3)],
        [(0,1),(1,1),(2,1),(3,1)],
    ],
    // ── O ────────────────────────────────────────────────────────────────────
    // All rotations identical:
    //  XX
    //  XX
    [
        [(0,0),(0,1),(1,0),(1,1)],
        [(0,0),(0,1),(1,0),(1,1)],
        [(0,0),(0,1),(1,0),(1,1)],
        [(0,0),(0,1),(1,0),(1,1)],
    ],
    // ── T ────────────────────────────────────────────────────────────────────
    // Rot 0:  Rot 1:  Rot 2:  Rot 3:
    //  .X.     .X.     ...     .X.
    //  XXX     .XX     XXX     XX.
    //  ...     .X.     .X.     .X.
    [
        [(0,1),(1,0),(1,1),(1,2)],
        [(0,1),(1,1),(1,2),(2,1)],
        [(1,0),(1,1),(1,2),(2,1)],
        [(0,1),(1,0),(1,1),(2,1)],
    ],
    // ── S ────────────────────────────────────────────────────────────────────
    // Rot 0:  Rot 1:  Rot 2:  Rot 3:
    //  .XX     X..     ...     X..
    //  XX.     XX.     .XX     XX.
    //  ...     .X.     XX.     .X.
    [
        [(0,1),(0,2),(1,0),(1,1)],
        [(0,0),(1,0),(1,1),(2,1)],
        [(0,1),(0,2),(1,0),(1,1)],
        [(0,0),(1,0),(1,1),(2,1)],
    ],
    // ── Z ────────────────────────────────────────────────────────────────────
    // Rot 0:  Rot 1:  Rot 2:  Rot 3:
    //  XX.     .X.     ...     .X.
    //  .XX     XX.     XX.     XX.
    //  ...     X..     .XX     X..
    [
        [(0,0),(0,1),(1,1),(1,2)],
        [(0,1),(1,0),(1,1),(2,0)],
        [(0,0),(0,1),(1,1),(1,2)],
        [(0,1),(1,0),(1,1),(2,0)],
    ],
    // ── J ────────────────────────────────────────────────────────────────────
    // Rot 0:  Rot 1:  Rot 2:  Rot 3:
    //  X..     XX.     ...     .X.
    //  XXX     X..     XXX     .X.
    //  ...     X..     ..X     XX.
    [
        [(0,0),(1,0),(1,1),(1,2)],
        [(0,0),(0,1),(1,0),(2,0)],
        [(0,0),(0,1),(0,2),(1,2)],
        [(0,1),(1,1),(2,0),(2,1)],
    ],
    // ── L ────────────────────────────────────────────────────────────────────
    // Rot 0:  Rot 1:  Rot 2:  Rot 3:
    //  ..X     X..     ...     XX.
    //  XXX     X..     XXX     .X.
    //  ...     XX.     X..     .X.
    [
        [(0,2),(1,0),(1,1),(1,2)],
        [(0,0),(1,0),(2,0),(2,1)],
        [(0,0),(0,1),(0,2),(1,0)],
        [(0,0),(0,1),(1,1),(2,1)],
    ],
];
