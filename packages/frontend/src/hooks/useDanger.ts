import { useSyncExternalStore } from 'react';
import { DangerSignal } from '../game/DangerSignal';

/**
 * Returns the current danger level (0–1) from a DangerSignal and re-renders
 * the component whenever it changes. Pass null if no active game session.
 */
export function useDanger(signal: DangerSignal | null): number {
  return useSyncExternalStore(
    (notify) => signal?.subscribe(notify) ?? (() => { }),
    () => signal?.value ?? 0,
  );
}
