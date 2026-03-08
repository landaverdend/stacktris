use rand::seq::SliceRandom;
use rand::thread_rng;
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

    /// SRS wall-kick offsets for this piece rotating from `from_rotation`.
    /// Returns 5 `(dc, dr)` offsets to try in order (first is always `(0,0)`).
    ///
    /// Coordinate conversion from the harddrop wiki (x=col, y=up):
    ///   wiki (x, y) → our (dc, dr) = (x, -y)  since rows increase downward.
    pub fn kick_offsets(self, from_rotation: u8, cw: bool) -> [(i8, i8); 5] {
        let i = from_rotation as usize % 4;
        match self {
            Piece::O => O_KICKS[i],
            Piece::I => if cw { I_CW_KICKS[i] } else { I_CCW_KICKS[i] },
            _ =>        if cw { JLSTZ_CW_KICKS[i] } else { JLSTZ_CCW_KICKS[i] },
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
    /// Rotation state
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

// ── SRS wall-kick tables ──────────────────────────────────────────────────────
// Offsets are (dc, dr) = (x, -y) from the harddrop.com/wiki/SRS tables.
// Indexed by from_rotation (0=spawn, 1=R, 2=2, 3=L).

#[rustfmt::skip]
const JLSTZ_CW_KICKS: [[(i8, i8); 5]; 4] = [
    [(0,0),(-1,0),(-1,-1),(0, 2),(-1, 2)], // 0→R
    [(0,0),( 1,0),( 1, 1),(0,-2),( 1,-2)], // R→2
    [(0,0),( 1,0),( 1,-1),(0, 2),( 1, 2)], // 2→L
    [(0,0),(-1,0),(-1, 1),(0,-2),(-1,-2)], // L→0
];

#[rustfmt::skip]
const JLSTZ_CCW_KICKS: [[(i8, i8); 5]; 4] = [
    [(0,0),( 1,0),( 1,-1),(0, 2),( 1, 2)], // 0→L
    [(0,0),( 1,0),( 1, 1),(0,-2),( 1,-2)], // R→0
    [(0,0),(-1,0),(-1,-1),(0, 2),(-1, 2)], // 2→R
    [(0,0),(-1,0),(-1, 1),(0,-2),(-1,-2)], // L→2
];

#[rustfmt::skip]
const I_CW_KICKS: [[(i8, i8); 5]; 4] = [
    [(0,0),(-2,0),( 1,0),(-2, 1),( 1,-2)], // 0→R
    [(0,0),(-1,0),( 2,0),(-1,-2),( 2, 1)], // R→2
    [(0,0),( 2,0),(-1,0),( 2,-1),(-1, 2)], // 2→L
    [(0,0),( 1,0),(-2,0),( 1, 2),(-2,-1)], // L→0
];

#[rustfmt::skip]
const I_CCW_KICKS: [[(i8, i8); 5]; 4] = [
    [(0,0),(-1,0),( 2,0),(-1,-2),( 2, 1)], // 0→L
    [(0,0),( 2,0),(-1,0),( 2,-1),(-1, 2)], // R→0
    [(0,0),( 1,0),(-2,0),( 1, 2),(-2,-1)], // 2→R
    [(0,0),(-2,0),( 1,0),(-2, 1),( 1,-2)], // L→2
];

// O piece never kicks.
const O_KICKS: [[(i8, i8); 5]; 4] = [[(0, 0); 5]; 4];

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

// ── 7-bag randomizer ──────────────────────────────────────────────────────────

const ALL_PIECES: [Piece; 7] = [
    Piece::I,
    Piece::O,
    Piece::T,
    Piece::S,
    Piece::Z,
    Piece::J,
    Piece::L,
];

struct PieceBag {
    bag: Vec<Piece>,
}

impl PieceBag {
    fn new() -> Self {
        let mut bag = Self {
            bag: Vec::with_capacity(7),
        };
        bag.refill();
        bag
    }

    fn next(&mut self) -> Piece {
        if self.bag.is_empty() {
            self.refill();
        }
        self.bag.pop().expect("bag is non-empty after refill")
    }

    fn refill(&mut self) {
        self.bag.extend_from_slice(&ALL_PIECES);
        self.bag.shuffle(&mut thread_rng());
    }
}

/// Shared rolling piece queue.
///
/// Both players read from the same pre-generated sequence via independent
/// index pointers. The queue grows lazily: `get(i)` generates pieces up to
/// index `i` on demand. This ensures player A and player B always get the
/// same piece for their Nth lock, regardless of when they lock.
pub struct PieceQueue {
    queue: Vec<Piece>,
    bag: PieceBag,
}

impl PieceQueue {
    pub fn new() -> Self {
        Self {
            queue: Vec::new(),
            bag: PieceBag::new(),
        }
    }

    /// Returns the piece at `index`, extending the queue if necessary.
    pub fn get(&mut self, index: usize) -> Piece {
        while self.queue.len() <= index {
            let p = self.bag.next();
            self.queue.push(p);
        }
        self.queue[index]
    }
}
