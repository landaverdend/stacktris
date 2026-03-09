/// Points for clearing `lines` lines.
///
/// `level` starts at 0; we multiply by `(level + 1)` so level-0 is not free.
/// `back_to_back` upgrades a Tetris from 800 → 1200 points.
/// `combo` is the number of consecutive line-clearing locks *before* this one
/// (0 = first in a chain → no combo bonus yet).
pub fn score_for_clear(lines: u32, level: u32, back_to_back: bool, combo: u32) -> u64 {
    let multiplier = (level + 1) as u64;
    let base: u64 = match lines {
        0 => return 0,
        1 => 100,
        2 => 300,
        3 => 500,
        4 => {
            if back_to_back { 1200 } else { 800 }
        }
        _ => 800,
    };
    let clear_pts = base * multiplier;
    let combo_pts = 50 * combo as u64 * multiplier;
    clear_pts + combo_pts
}

/// Lines of garbage sent to the opponent after a clear.
pub fn garbage_for_clear(lines: u32, back_to_back: bool) -> u32 {
    match lines {
        0 | 1 => 0,
        2 => 1,
        3 => 2,
        4 => if back_to_back { 5 } else { 4 },
        _ => 4,
    }
}

/// Level derived from total lines cleared: one level per 10 lines.
pub fn level_for_lines(total_lines: u32) -> u32 {
    total_lines / 10
}
