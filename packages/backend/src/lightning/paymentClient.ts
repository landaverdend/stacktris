import { WebSocket } from 'ws';
// @ts-ignore – Node.js has no global WebSocket; polyfill it before NWCClient is used
globalThis.WebSocket ??= WebSocket;

export { PaymentClient } from '@stacktris/shared';
