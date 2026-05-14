import { InputAction } from '@stacktris/shared';

export interface IInputHandler {
  attach(): void;
  detach(): void;
  tick(now: number): void;
}

/** Factory injected into LocalGame so it can create the handler with the engine's callback. */
export type InputHandlerFactory = (onAction: (action: InputAction) => void) => IInputHandler;
