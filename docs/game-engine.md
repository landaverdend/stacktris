# Game Engine Design

## Board

```
(0,0)──────────────── x=9
  │  [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
  │  [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
  │  ...
y=19 [ ][ ][ ][ ][ ][ ][ ][ ][ ][ ]
```

- 10 columns × 20 visible rows
- Internally 24 rows (4 hidden "buffer" rows above y=0 for piece spawn)
- Each cell is `Option<TetrominoType>` — `None` is empty, `Some(T)` is a locked piece

```rust
// game/board.rs
pub type Board = [[Option<TetrominoType>; 10]; 24];  // [row][col], 0=top
```

The 4 hidden rows let pieces spawn off-screen and slide down naturally. The renderer
always shows rows 4..24 (the visible portion).

---

## Pieces & Rotation (SRS)

Tetris uses the **Super Rotation System (SRS)**. Each of the 7 tetrominos has 4 rotation
states, and wall-kick tables define how pieces shift when a rotation would otherwise
overlap the wall or locked pieces.

```rust
// game/piece.rs
pub enum TetrominoType { I, O, T, S, Z, J, L }

pub struct Piece {
    pub kind: TetrominoType,
    pub col: i32,    // left edge of bounding box
    pub row: i32,    // top edge of bounding box (can be negative in spawn buffer)
    pub rotation: u8, // 0..3
}
```

Rotation tables are stored as static arrays of `(col_offset, row_offset)` bitmasks per
rotation state. Wall kicks are tested in priority order — the first valid position wins.

SRS wall kick tables are well-documented and should be copied verbatim from the
[Tetris wiki](https://tetris.wiki/SRS). The I piece has different kick tables from
J/L/S/T/Z, so handle them separately.

---

## Piece Queue (Shared 7-Bag)

Both players draw from the **same deterministic sequence** seeded from a per-room random
u64. This is the "same bag" rule used in competitive Tetris — it's fair because both
players encounter the same piece distribution, just at their own pace.

```rust
// game/queue.rs
pub struct PieceQueue {
    seed: u64,
    sequence: Vec<TetrominoType>,  // grows lazily in 7-piece chunks
}

impl PieceQueue {
    /// Both players call this independently with their own queue_index
    pub fn get(&mut self, index: usize) -> TetrominoType {
        // extend sequence if needed
        while self.sequence.len() <= index {
            self.append_bag();
        }
        self.sequence[index]
    }

    fn append_bag(&mut self) {
        // Fisher-Yates shuffle of [I,O,T,S,Z,J,L] using self.seed
        // advance seed each time (e.g. LCG or wyrand)
    }
}
```

Each `PlayerGameState` has a `queue_index: usize` that it increments each time it
consumes a piece. The preview ("next pieces") is `queue.get(index)` through
`queue.get(index + N_PREVIEW - 1)`. Both players share the same `PieceQueue` instance
owned by the room actor.

**Why this is fair**: Both players see piece #0 first, piece #1 second, etc. Player skill
determines how fast they advance through the sequence and how efficiently they use each piece.

---

## Gravity & Lock Delay

Gravity is applied on a timer that fires at a rate determined by the current level:

```
Level 0:  800ms/row
Level 1:  720ms/row
...
Level 9:  100ms/row
Level 10+: 80ms/row
```

**Lock delay**: when a piece touches the stack it doesn't lock immediately. The player
gets 500ms to slide/rotate it into a better position. However there is a limit of 15
moves/rotations before the piece force-locks regardless of the timer. This matches
standard Tetris behavior and prevents infinite stalling.

```rust
// game/gravity.rs
pub struct GravityState {
    pub fall_timer: Duration,   // time until next automatic drop
    pub lock_timer: Option<Duration>,  // Some() when piece is touching the stack
    pub lock_move_count: u8,    // resets when piece moves down, caps at 15
}
```

On each game tick the room actor decrements these timers. Soft drop multiplies gravity
speed by 20× (or sets it to 1 row per tick, whichever is faster).

---

## Scoring

Standard Tetris scoring scaled by level:

| Lines cleared | Points (× level+1) |
|---|---|
| 1 (Single) | 100 |
| 2 (Double) | 300 |
| 3 (Triple) | 500 |
| 4 (Tetris) | 800 |

Additional bonuses:
- **Soft drop**: +1 per row
- **Hard drop**: +2 per row
- **Back-to-back Tetris**: ×1.5 on the 800 (so 1200 points)
- **T-spin**: future, not in v1

Level increases every 10 lines cleared.

---

## Garbage (Battle Mechanic)

When you clear lines you send "garbage" to your opponent. Garbage lines are added to
the **bottom** of the opponent's board, pushing everything up.

| Lines cleared | Garbage sent |
|---|---|
| 1 (Single) | 0 |
| 2 (Double) | 1 |
| 3 (Triple) | 2 |
| 4 (Tetris) | 4 |
| B2B Tetris | +1 bonus |

**Garbage line format**: a complete row with exactly **one random hole** (empty cell).
Within a "chunk" of garbage sent together, all rows share the same hole column — this
lets the recipient stack their pieces over the hole and eventually dig out. A new
garbage chunk gets a new random hole column.

**Timing**: garbage is queued on the sender's side when lines are cleared but not applied
to the opponent immediately. It's applied to the opponent's board on the **next piece
lock**. This gives the recipient a chance to see it coming and react (the pending garbage
is shown as a colored column on the left side of their board).

**Cancellation**: if the recipient also sends garbage before the queued garbage applies,
the amounts cancel out. E.g. if A has 3 queued to send B, and B clears a double (1
garbage), B's 1 cancels against A's 3 and A only sends 2.

```rust
// game/garbage.rs
pub struct PendingGarbage {
    pub lines: u32,
    pub hole_col: usize,
}

pub fn apply_garbage(board: &mut Board, garbage: &[PendingGarbage]) { ... }
pub fn garbage_for_clear(lines: u32, back_to_back: bool) -> u32 { ... }
```

---

## Piece Spawn

New pieces spawn centered horizontally at the top of the board (in the hidden buffer rows):

- **I piece**: spawns at row -1 (one row above visible area), col 3
- **All others**: spawn at row -1, col 3 (bounding box top-left)

If a newly spawned piece immediately collides with locked cells, the game is over for
that player. This is called **block out** (or **lock out** if a piece locks partially
above the visible area).

---

## Game Over Conditions

Standard competitive Tetris game-over conditions:

1. **Block out**: a new piece spawns and immediately overlaps locked cells
2. **Lock out**: a piece locks entirely above the visible area (row < 4)

When one player tops out, the other player is the winner. If they top out simultaneously
on the same tick, the one with the higher score wins (or it's a draw if equal).

---

## State Snapshot (broadcast format)

After each meaningful event the room actor sends both players a full state snapshot.
The snapshot is intentionally simple — no delta encoding in v1.

```rust
pub struct GameStateSnapshot {
    pub room_id: String,
    pub phase: RoomPhase,
    pub your_state: PlayerSnapshot,
    pub opponent_state: OpponentSnapshot,
}

pub struct PlayerSnapshot {
    pub board: Vec<Vec<Option<String>>>,  // serialized as string for JSON
    pub current_piece: PieceSnapshot,
    pub next_pieces: Vec<TetrominoType>,  // N_PREVIEW pieces ahead
    pub hold_piece: Option<TetrominoType>,
    pub pending_garbage: u32,
    pub score: u64,
    pub lines: u32,
    pub level: u32,
}

pub struct OpponentSnapshot {
    pub board: Vec<Vec<Option<String>>>,
    pub pending_garbage: u32,
    pub score: u64,
    pub lines: u32,
    pub level: u32,
    // no current_piece — client doesn't need to know opponent's exact piece
}
```

Note the asymmetry: the opponent snapshot intentionally omits `current_piece` and
`next_pieces`. The client renders the opponent's board as a static snapshot, updated
whenever the server broadcasts. This prevents cheating (knowing opponent's piece queue).
