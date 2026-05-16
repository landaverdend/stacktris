import { InputHandlerFactory } from './IInputHandler';

export interface LocalPlayerConfig {
  playerId: string;
  displayName: string;
  lightningAddress: string;
  /** undefined = default keyboard handler */
  inputFactory?: InputHandlerFactory;
  /** false until payment is confirmed; auto-true when buyIn === 0 */
  paid: boolean;
  /** DAS in ms — undefined means use global setting */
  dasMs?: number;
  /** ARR in ms — undefined means use global setting */
  arrMs?: number;
}

export function defaultLocalPlayerConfig(index: number, buyIn: number): LocalPlayerConfig {
  return {
    playerId: `p${index + 1}`,
    displayName: `P${index + 1}`,
    lightningAddress: '',
    inputFactory: undefined,
    paid: buyIn === 0,
  };
}
