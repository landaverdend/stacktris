# Garbage System

## Overview

Garbage is the core attack/defense mechanic in battle Tetris. When you clear lines,
you send "garbage" rows to your opponent's board. Garbage rows rise from the bottom
with a single hole, forcing your opponent to play through them.

## Mechanics

### Sending

Clearing lines generates garbage according to `scoring::garbage_for_clear`:

| Lines cleared | Garbage sent | Notes            |
|---------------|-------------|------------------|
| 0             | 0           |                  |
| 1 (single)    | 0           |                  |
| 2 (double)    | 1           |                  |
| 3 (triple)    | 2           |                  |
| 4 (tetris)    | 4           |                  |
| 4 B2B tetris  | 5           | Back-to-back bonus |

### Canceling

Before outgoing garbage reaches the opponent it is applied against the attacker's
**own** incoming queue. This is the central strategy: clear lines while you have
pending garbage to neutralize an incoming attack.

Example:
- You have 3 incoming garbage lines.
- You clear a double (2 sent).
- 2 lines cancel from your queue → you now have 1 incoming, opponent receives 0.

### Landing

Garbage does **not** arrive instantly. It sits in `PlayerGameState::pending_garbage`
and lands on the board at **lock time, after your own line clear is processed**.

Sequence on every piece lock:

```
1. lock_piece      — stamp piece onto board
2. clear_lines     — remove full rows, compute sent garbage
3. apply_clear     — update score / combo / level
4. cancel          — subtract sent from own pending_garbage; remainder goes to opponent
5. add_garbage     — flush own pending_garbage onto bottom of board
6. spawn_next      — advance queue, spawn new piece
```

### Garbage Row Format

Each garbage row is fully filled (cell value `8` = gray) except for one hole column.
The hole column is chosen randomly per **batch** (all rows from one attack share the
same hole), allowing players to plan a path through the garbage.

## Cell Values

| Value | Meaning  |
|-------|----------|
| 0     | Empty    |
| 1     | I piece  |
| 2     | O piece  |
| 3     | T piece  |
| 4     | S piece  |
| 5     | Z piece  |
| 6     | J piece  |
| 7     | L piece  |
| 8     | Garbage  |

## Implementation

| File | Change |
|------|--------|
| `backend/src/game/logic.rs` | `add_garbage(board, count)` — shifts rows up, fills bottom with gray rows |
| `backend/src/game/session.rs` | `lock_and_advance` — cancel → send → flush garbage before spawn |
| `frontend/src/render/board.ts` | `COLORS[8] = '#888888'` — gray garbage color |

## Future Considerations

- **Garbage meter UI**: Visual bar showing incoming garbage height beside the board.
- **Chunk-based hole tracking**: Store hole column per chunk so multi-batch garbage
  has distinct hole columns per attack (currently all lines in one batch share a hole).
- **Messiness setting**: Competitive games often have a "messiness" parameter that
  randomly shifts the hole column between rows for harder-to-clear garbage.
