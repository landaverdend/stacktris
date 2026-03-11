// ── Snapshot types (match server protocol.rs) ─────────────────────────────────
export interface PieceSnapshot {
  kind: string;
  row: number;
  col: number;
  rotation: number;
  lock_active: boolean;
}


// --- WebSocket connection status ────────────────────────────────────────────
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

