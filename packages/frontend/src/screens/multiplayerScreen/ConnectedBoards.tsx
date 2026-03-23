import { Board, PlayerInfo } from '@stacktris/shared';
import { OpponentBoard } from '../../components/OpponentBoard';
import { OPPONENT_CELL_SIZE } from '../../render/board';

const BW = 10 * OPPONENT_CELL_SIZE;
const BH = 20 * OPPONENT_CELL_SIZE;
const GAP = 12;       // matches gap-3
const TRUNK = 28;     // space above boards for the horizontal trunk line
const TAIL = 16;      // space below boards for the tail line
const COLS = 3;

const EMPTY_BOARD: Board = Array.from({ length: 22 }, () => Array(10).fill(0));

interface Props {
  players: PlayerInfo[];
  opponentBoards: Record<string, Board>;
}

export function ConnectedBoards({ players, opponentBoards }: Props) {
  const count = players.length;
  if (count === 0) return null;

  const cols = Math.min(count, COLS);
  const rows = Math.ceil(count / COLS);

  // Container dimensions including trunk/tail padding
  const containerW = cols * BW + (cols - 1) * GAP;
  const containerH = TRUNK + rows * BH + (rows - 1) * GAP + TAIL;

  // Build line segments per row
  const lines: [number, number, number, number][] = [];

  for (let r = 0; r < rows; r++) {
    const rowCount = Math.min(COLS, count - r * COLS);

    // Y positions relative to the SVG (which starts at top of container)
    const boardTopY = TRUNK + r * (BH + GAP);
    const boardBotY = boardTopY + BH;
    const trunkY = boardTopY - TRUNK / 2;
    const tailY = boardBotY + TAIL / 2;

    const firstCX = BW / 2;
    const lastCX = (rowCount - 1) * (BW + GAP) + BW / 2;

    // Horizontal trunk
    if (rowCount > 1) lines.push([firstCX, trunkY, lastCX, trunkY]);

    for (let c = 0; c < rowCount; c++) {
      const cx = c * (BW + GAP) + BW / 2;
      lines.push([cx, trunkY, cx, boardTopY]); // drop into board top
      lines.push([cx, boardBotY, cx, tailY]);   // tail out of board bottom
    }

    // Horizontal bottom trunk
    if (rowCount > 1) lines.push([firstCX, tailY, lastCX, tailY]);
  }

  return (
    <div className="relative" style={{ width: containerW, height: containerH }}>
      {/* SVG wiring */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={containerW}
        height={containerH}
      >
        <defs>
          <filter id="amber-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#amber-glow)" stroke="#ff7020" strokeWidth="1.5" opacity="0.75" fill="none">
          {lines.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
      </svg>

      {/* Boards grid, offset by trunk padding */}
      <div
        className="absolute grid gap-3"
        style={{
          top: TRUNK,
          left: 0,
          gridTemplateColumns: `repeat(${COLS}, ${BW}px)`,
        }}
      >
        {players.map(p => (
          <OpponentBoard
            key={p.playerId}
            board={opponentBoards[p.playerId] ?? EMPTY_BOARD}
            playerName={p.playerName}
          />
        ))}
      </div>
    </div>
  );
}
