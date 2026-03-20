# Lightning Betting Layer — Design Document

## Provider: Alby API

Use the **Alby merchant API** (`@getalby/sdk`). It is pure HTTPS with an API key, zero infrastructure to run, and covers both invoice creation and outbound payments.

```bash
npm install @getalby/sdk better-sqlite3 @types/better-sqlite3
```

**Why not the alternatives:**

| Option | Reason Rejected |
|---|---|
| NWC (Nostr Wallet Connect) | For connecting a *user's* wallet, not server-side invoice issuance |
| OpenNode | Higher withdrawal fees, slower outbound payments |
| Strike | No outbound payment API for arbitrary invoices |
| Voltage / self-hosted LND | Requires running a new service |

**Tradeoffs to accept:**
- Alby holds the funds between invoice settlement and winner payout. Custodial for match duration (typically 5–15 minutes).
- If Alby is down, invoice creation and payouts fail. Mitigate with retry logic and a manual claim fallback.
- Outbound payments incur Lightning routing fees (typically 0–10 sats). Communicate to players as "net payout = pot minus routing fees."

---

## Room FSM: New `awaiting_bets` State

Do **not** collapse payment state into `RoomStatus`. The room FSM controls game flow; payment state is per-player and runs in parallel. The FSM only gates on payment at one point: before the **first round of the match**.

Bets are placed **once per session** — not per round. Subsequent rounds cycle through `finished → waiting → countdown → playing` without triggering bet collection again.

```
First round only:
  waiting → countdown → awaiting_bets → playing → finished
                ↓                                     ↓
             waiting                              waiting  ← subsequent rounds re-ready here
             (unready)                                ↓
                                                  countdown → playing (no awaiting_bets)
```

`awaiting_bets` can also transition back to `waiting` if a player disconnects before all bets are paid.

```typescript
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  waiting:        ['countdown'],
  countdown:      ['waiting', 'awaiting_bets', 'playing'],  // 'playing' for rounds 2+
  awaiting_bets:  ['waiting', 'playing'],
  playing:        ['finished'],
  finished:       ['waiting'],
};
```

The `countdown` → `awaiting_bets` vs `countdown` → `playing` branch is decided by `_isSessionStarted`:

```typescript
private onCountdownComplete(): void {
  if (!this._isSessionStarted && this.betSats > 0) {
    this.startBetCollection();  // first round, collect bets
  } else {
    this.startGame();           // subsequent rounds, skip straight to playing
  }
}
```

---

## Full Flow

### Phase 1: Lobby (`waiting`)

1. Player connects over WebSocket, gets assigned a `playerId`.
2. Player joins a room. No payment action yet.
3. Player sends `ready_update: true`. No payment action yet.
4. If `betSats === 0`, skip all payment logic entirely.

### Phase 2: Bet Collection (`countdown` → `awaiting_bets`)

When the countdown timer completes, instead of calling `startGame()` directly, call `startBetCollection()`:

```typescript
private async startBetCollection(): Promise<void> {
  this.fsm.transition('awaiting_bets');

  if (this.betSats === 0) {
    this.startGame();
    return;
  }

  for (const [playerId, player] of this.players) {
    const invoice = await alby.createInvoice({
      amount: this.betSats,
      memo: `Stacktris room ${this.id} — ${player.playerName}`,
      expiry: 600,
    });
    this.betState.payments.set(playerId, {
      playerId,
      paymentHash: invoice.payment_hash,
      bolt11: invoice.payment_request,
      amountSats: this.betSats,
      status: 'invoice_issued',
      payoutInvoice: null,
      issuedAt: Date.now(),
      paidAt: null,
    });
    player.sendFn({
      type: 'bet_invoice_issued',
      bolt11: invoice.payment_request,
      paymentHash: invoice.payment_hash,
      expiresAt: Date.now() + 600_000,
    });
  }

  this.persistBetState();
  this.startPaymentTimeoutTimer();  // 10-minute timeout
}
```

### Phase 3: Waiting for Payments (`awaiting_bets`)

Subscribe to Alby's SSE stream for `invoice.settled` events:

```typescript
private onInvoiceSettled(paymentHash: string): void {
  for (const [playerId, payment] of this.betState.payments) {
    if (payment.paymentHash === paymentHash && payment.status === 'invoice_issued') {
      payment.status = 'paid';
      payment.paidAt = Date.now();
      this.betState.potSats += payment.amountSats;
      this.persistBetState();

      const paid = [...this.betState.payments.values()]
        .filter(p => p.status === 'paid').map(p => p.playerId);
      const unpaid = [...this.betState.payments.values()]
        .filter(p => p.status === 'invoice_issued').map(p => p.playerId);

      this.broadcast({ type: 'bet_payment_confirmed', playerId });
      this.broadcast({ type: 'bet_waiting_for_players', paid, unpaid });

      if (this.checkAllPaid()) {
        this.clearPaymentTimeoutTimer();
        this.startGame();
      }
      break;
    }
  }
}
```

**Payout Lightning Address collection:** During `awaiting_bets`, each player should have already provided their Lightning Address when joining the room. The server resolves this to a fresh BOLT11 invoice at payout time — no pre-submission needed, no expiry race.

### Phase 4: In-Game (`playing`)

No payment logic. `SessionBetState` is frozen — all payments are `paid`.

### Phase 5: Winner Payout

Triggered when `matchWinnerId` is set in `onGameEnd`:

```typescript
private async onMatchComplete(winnerId: string): Promise<void> {
  const winnerPayment = this.betState.payments.get(winnerId);
  const potSats = this.betState.potSats;

  if (!winnerPayment?.payoutInvoice) {
    // Fallback: generate a LNURL-withdraw link
    const lnurlWithdraw = await this.generateLNURLWithdraw(winnerId, potSats);
    this.players.get(winnerId)?.sendFn({
      type: 'payout_failed',
      reason: `No payout invoice on file. Claim your ${potSats} sats here: ${lnurlWithdraw}`,
    });
    return;
  }

  // Retry with exponential backoff
  let attempt = 0;
  while (attempt < 5) {
    try {
      const result = await alby.sendPayment({ invoice: winnerPayment.payoutInvoice });
      this.betState.payoutObligationFulfilled = true;
      this.persistBetState();
      this.players.get(winnerId)?.sendFn({
        type: 'payout_sent',
        paymentHash: result.payment_hash,
        amountSats: potSats,
      });
      return;
    } catch {
      attempt++;
      if (attempt < 5) await sleep(1000 * 2 ** attempt);  // 2s, 4s, 8s, 16s
    }
  }

  // All retries failed — player can claim via /claim/:roomId
  this.persistBetState();
  this.players.get(winnerId)?.sendFn({
    type: 'payout_failed',
    reason: `Payout failed after retries. Visit /claim/${this.id} to submit a new invoice.`,
  });
}
```

---

## Disconnect & Forfeit Handling

### Before Game Starts (`waiting` or `awaiting_bets`)

| Scenario | Action |
|---|---|
| Disconnect in `waiting` | Remove from room. No payment action (never paid). |
| Disconnect in `awaiting_bets`, invoice not paid | Mark `refunded`. Transition room to `waiting`. Refund any players who already paid. |
| Disconnect in `awaiting_bets`, invoice already paid | Refund the paid player. Transition room to `waiting`. |

The game was never agreed to — disconnecting player has a legitimate claim on their sats.

### After Game Starts (`playing` or `finished`)

Once `startGame()` fires, **all bets are locked. No refunds.**

| Scenario | Action |
|---|---|
| Disconnect during `playing` | Start 30-second forfeit grace timer. |
| Reconnect within 30 seconds | Cancel timer. Send state resync to player. |
| No reconnect after 30 seconds | Call `game.removePlayer(playerId)`. Mark `forfeited`. Sats already in pot. |
| Disconnect in `finished` (between rounds) | Same forfeit logic — match is ongoing. |

```typescript
private readonly FORFEIT_GRACE_MS = 30_000;
private forfeitTimers: Map<string, NodeJS.Timeout> = new Map();

public onPlayerDisconnect(playerId: string): void {
  const player = this.players.get(playerId);
  if (!player) return;
  player.disconnectedAt = Date.now();

  if (this.status === 'playing' || this.status === 'finished') {
    const timer = setTimeout(() => this.enforceForfeit(playerId), this.FORFEIT_GRACE_MS);
    this.forfeitTimers.set(playerId, timer);
    this.broadcast({ type: 'player_disconnected', playerId, gracePeriodMs: this.FORFEIT_GRACE_MS });
  } else {
    this.handlePreGameDisconnect(playerId);
  }
}

public onPlayerReconnect(playerId: string, newSendFn: SendFn): void {
  const timer = this.forfeitTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    this.forfeitTimers.delete(playerId);
  }
  const player = this.players.get(playerId);
  if (player) {
    player.sendFn = newSendFn;
    player.disconnectedAt = null;
    this.sendStateSyncTo(playerId);
  }
}

private enforceForfeit(playerId: string): void {
  this.forfeitTimers.delete(playerId);
  const payment = this.betState.payments.get(playerId);
  if (payment) payment.status = 'forfeited';
  this.persistBetState();
  this.game?.removePlayer(playerId);
  this.broadcast({ type: 'player_forfeited', playerId });
}
```

**Reconnection requirement:** `playerId` must be persisted on the client (localStorage) and re-sent on reconnect via a new `rejoin` message. The `RoomRegistry` must preserve the `playerIdToRoom` mapping during the grace period instead of deleting it on disconnect.

---

## Crash Recovery

Use **SQLite via `better-sqlite3`** — no extra service, synchronous API, survives process restarts.

```typescript
// packages/backend/src/db.ts
db.exec(`
  CREATE TABLE IF NOT EXISTS bet_sessions (
    room_id             TEXT PRIMARY KEY,
    status              TEXT NOT NULL,
    pot_sats            INTEGER NOT NULL DEFAULT 0,
    payments            TEXT NOT NULL,        -- JSON
    winner_id           TEXT,
    payout_fulfilled    INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
  );
`);
```

On startup, before accepting any connections:

```typescript
async function recoverSessions(): Promise<void> {
  const unresolved = loadUnresolvedSessions();
  for (const session of unresolved) {
    if (session.status === 'awaiting_bets') {
      await refundAllPaidPlayers(session);
    } else if (session.status === 'playing' || session.status === 'finished') {
      if (session.winnerId) {
        await retryWinnerPayout(session);
      } else {
        await refundAllPaidPlayers(session);
      }
    }
  }
}
```

> **Key accounting risk:** With standard invoices (not HODL), if a player pays and the server crashes before the game starts, you owe a refund from your Alby balance. Calling `persistBetState()` immediately after each invoice is issued mitigates this — crash recovery will issue the refund on restart.

---

## New Types

### `packages/shared/src/index.ts`

```typescript
export type RoomStatus = "waiting" | "countdown" | "awaiting_bets" | "playing" | "finished";

// Server → Client additions
| { type: 'bet_invoice_issued'; bolt11: string; paymentHash: string; expiresAt: number }
| { type: 'bet_payment_confirmed'; playerId: string }
| { type: 'bet_waiting_for_players'; paid: string[]; unpaid: string[] }
| { type: 'player_disconnected'; playerId: string; gracePeriodMs: number }
| { type: 'player_forfeited'; playerId: string }
| { type: 'payout_sent'; paymentHash: string; amountSats: number }
| { type: 'payout_failed'; reason: string }

// Client → Server additions
| { type: 'submit_payout_invoice'; bolt11: string }
| { type: 'rejoin'; playerId: string; roomId: string }

// Updated RoomInfo
export interface RoomInfo {
  roomId: string;
  playerCount: number;
  betSats: number;
  createdAt: number;
  potSats: number;  // running total including forfeited sats
}
```

### `packages/backend/src/types.ts`

```typescript
export type PlayerPaymentStatus =
  | 'none'
  | 'invoice_issued'
  | 'paid'
  | 'forfeited'
  | 'refunded';

export interface PlayerPayment {
  playerId: string;
  paymentHash: string;
  bolt11: string;
  amountSats: number;
  status: PlayerPaymentStatus;
  payoutInvoice: string | null;
  issuedAt: number;
  paidAt: number | null;
}

export interface SessionBetState {
  roomId: string;
  potSats: number;
  payments: Map<string, PlayerPayment>;
  payoutObligationFulfilled: boolean;
}

// Updated PlayerSlot
export interface PlayerSlot {
  playerId: string;
  playerName: string;
  sendFn: SendFn;
  ready: boolean;
  disconnectedAt: number | null;  // null = connected
}
```

---

## Tradeoffs Summary

| Decision | Gain | Accept |
|---|---|---|
| Alby API over self-hosted LND | Zero infra, fast setup | Custodial during match; Alby outage = no games |
| Standard invoices over HODL | No node required | Server owes refund from Alby balance if crash before game starts |
| SQLite over Redis | No extra service | Single-process only |
| 30-second forfeit grace | Players can reconnect on flaky connections | 30 seconds of a missing player visible to others |
| Lightning Address for payout | Server generates invoice at payout time, no expiry race | Player must have a Lightning Address (most wallets do) |
| LNURL-withdraw fallback | Winner can always claim eventually | Requires LNURL server-side implementation |

---

## Local Testing

You cannot point the Alby SDK at a Polar node — the SDK talks to Alby's hosted API. The right approach is a `LightningWallet` abstraction with a `MockWallet` for local dev, switching via env var.

### The abstraction

```typescript
// packages/backend/src/lightning/types.ts
export interface LightningWallet {
  createInvoice(amountSats: number, memo: string): Promise<{ bolt11: string; paymentHash: string }>;
  waitForPayment(paymentHash: string): Promise<void>;
  payLightningAddress(address: string, amountSats: number): Promise<void>;
}
```

### MockWallet (local dev)

Auto-confirms payments after a short delay. No real Lightning, no Polar needed.

```typescript
// packages/backend/src/lightning/mock.ts
export class MockWallet implements LightningWallet {
  private pending = new Map<string, () => void>();

  async createInvoice(amountSats: number, memo: string) {
    const paymentHash = crypto.randomUUID().replace(/-/g, '');
    const bolt11 = `lnbcrt${amountSats}mock${paymentHash}`;  // fake but parseable for display
    // Auto-confirm after 2 seconds
    setTimeout(() => this.pending.get(paymentHash)?.(), 2000);
    return { bolt11, paymentHash };
  }

  waitForPayment(paymentHash: string): Promise<void> {
    return new Promise(resolve => this.pending.set(paymentHash, resolve));
  }

  async payLightningAddress(address: string, amountSats: number) {
    console.log(`[MockWallet] paid ${amountSats} sats to ${address}`);
  }
}
```

### AlbyWallet (production)

```typescript
// packages/backend/src/lightning/alby.ts
export class AlbyWallet implements LightningWallet {
  // ... @getalby/sdk implementation
}
```

### Wiring via env var

```typescript
// packages/backend/src/lightning/index.ts
import { MockWallet } from './mock.js';
import { AlbyWallet } from './alby.js';

export const lightning: LightningWallet =
  process.env.LIGHTNING_PROVIDER === 'alby'
    ? new AlbyWallet()
    : new MockWallet();
```

```bash
# .env.local
LIGHTNING_PROVIDER=mock

# .env.production
LIGHTNING_PROVIDER=alby
ALBY_ACCESS_TOKEN=your_token_here
```

This means you can develop and test the entire betting flow locally — bet collection, payment confirmation, payout — without touching real Lightning or needing Polar at all. Polar remains useful if you want to test the `AlbyWallet` implementation specifically, but you'd need an intermediary (LNbits connected to Polar) to bridge the two since Alby can't be pointed at a local node directly.

---

## Recommended Implementation Order

1. Add `awaiting_bets` to `RoomStatus` and FSM transitions (no payment logic yet)
2. Add SQLite `bet_sessions` table and `persistBetState()`
3. Integrate Alby SDK, add `ALBY_ACCESS_TOKEN` env var, test invoice creation in isolation
4. Wire `startBetCollection()` and invoice settlement via Alby SSE
5. Add `submit_payout_invoice` message + validation + winner payout with retry
6. Implement `onPlayerDisconnect` grace period + forfeit enforcement
7. Implement crash recovery on startup (`recoverSessions()`)
8. Add client-side reconnection flow (`rejoin` message + localStorage `playerId`)
