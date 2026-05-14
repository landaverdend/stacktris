import { RoundBase } from '@stacktris/shared';
import { LocalGame } from './LocalGame';

export class LocalRound extends RoundBase<LocalGame> {
  constructor(games: Record<string, LocalGame>, seed: number) {
    super(games, seed);
  }

  // No transport side-effects needed — LocalArena handles UI directly via game subscriptions.
  protected onKillPlayer(_playerId: string): void {}
  protected onGameOver(_winnerId: string | null): void {}
  protected onRouteGarbage(_attackerId: string, _targetId: string, _lines: number, _frame: number, _gap: number): void {}
}
