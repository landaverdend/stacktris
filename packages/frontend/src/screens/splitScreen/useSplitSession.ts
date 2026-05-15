import { useState, useEffect, useCallback, useRef } from 'react';
import { WINS_TO_MATCH } from '@stacktris/shared';
import { LocalSession, LocalMatchSnapshot } from '../../game/LocalSession';
import { LocalPaymentService } from '../../game/LocalPaymentService';
import { storage } from '../../lib/storage';

export type IntermissionPlayer = {
  playerId: string;
  slotIndex: number;
  playerName: string;
  ready: boolean;
  paid: boolean;
  wins: number;
};

export type SplitSessionState = {
  // Raw state
  buyIn: number;
  inputBuyIn: number;
  snapshot: LocalMatchSnapshot;
  // Payment
  invoices: Record<string, string | null>;
  invoiceErrors: Record<string, string | null>;
  lightningAddresses: Record<string, string>;
  nwcMissing: boolean;
  // Derived
  potSats: number;
  aliveCount: number;
  showIntermission: boolean;
  intermissionPlayers: IntermissionPlayer[];
  // Handlers
  handleBuyInInput: (val: number) => void;
  handleAddressChange: (playerId: string, addr: string) => void;
  toggleReady: (playerId: string, ready: boolean) => void;
  addPlayer: () => void;
  removePlayer: () => void;
  resetSession: () => void;
};

export function useSplitSession(): SplitSessionState {
  const [buyIn, setBuyIn] = useState(0);
  const [inputBuyIn, setInputBuyIn] = useState(0);
  const buyInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [session, setSession] = useState(() => new LocalSession(2, 0));
  const [snapshot, setSnapshot] = useState<LocalMatchSnapshot>(() => session.snapshot);

  const [invoices, setInvoices] = useState<Record<string, string | null>>({});
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string | null>>({});
  const [lightningAddresses, setLightningAddresses] = useState<Record<string, string>>({});
  const [nwcMissing, setNwcMissing] = useState(false);
  const paymentServiceRef = useRef<LocalPaymentService | null>(null);

  // Refs so callbacks don't capture stale state
  const playerCountRef = useRef(2);
  playerCountRef.current = snapshot.playerCount;
  const buyInRef = useRef(0);
  buyInRef.current = buyIn;

  // Sync snapshot
  useEffect(() => {
    setSnapshot(session.snapshot);
    const unsub = session.subscribe(() => setSnapshot(session.snapshot));
    return () => {
      unsub();
      session.destroy();
    };
  }, [session]);

  // Payment service — recreated when session or committed buyIn changes
  useEffect(() => {
    if (buyIn === 0) return;

    const nwcString = storage.get('nwcString');
    if (!nwcString) {
      setNwcMissing(true);
      return;
    }
    setNwcMissing(false);

    const storedAddress = storage.get('lightningAddress') ?? '';
    setLightningAddresses({ p1: storedAddress });

    const svc = new LocalPaymentService(nwcString, buyIn);
    paymentServiceRef.current = svc;

    const configs = session.snapshot.playerConfigs;
    setInvoices(Object.fromEntries(configs.map((c) => [c.playerId, null])));
    setInvoiceErrors({});

    for (const config of configs) {
      const address = config.playerId === 'p1' ? storedAddress : '';
      svc
        .generateInvoice(config.playerId, address, () => session.setPlayerPaid(config.playerId))
        .then((bolt11) => setInvoices((prev) => ({ ...prev, [config.playerId]: bolt11 })))
        .catch((err) => setInvoiceErrors((prev) => ({ ...prev, [config.playerId]: String(err) })));
    }

    return () => {
      svc.destroy();
      paymentServiceRef.current = null;
    };
  }, [session, buyIn]);

  // Payout on match end
  useEffect(() => {
    const { status, matchWinnerId } = snapshot;
    if (status === 'finished' && matchWinnerId && paymentServiceRef.current) {
      paymentServiceRef.current.onMatchComplete(matchWinnerId).catch(console.error);
    }
  }, [snapshot.status, snapshot.matchWinnerId]);

  const createSession = useCallback((count: number, bi: number) => {
    setSession(new LocalSession(count, bi));
  }, []);

  const handleBuyInInput = useCallback(
    (val: number) => {
      setInputBuyIn(val);
      if (buyInTimerRef.current) clearTimeout(buyInTimerRef.current);
      buyInTimerRef.current = setTimeout(() => {
        setBuyIn(val);
        createSession(playerCountRef.current, val);
      }, 400);
    },
    [createSession],
  );

  const handleAddressChange = useCallback(
    (playerId: string, addr: string) => {
      setLightningAddresses((prev) => ({ ...prev, [playerId]: addr }));
      paymentServiceRef.current?.setLightningAddress(playerId, addr);
      session.setPlayerConfig(playerId, { lightningAddress: addr });
    },
    [session],
  );

  const toggleReady = useCallback(
    (playerId: string, ready: boolean) => {
      session.readyUp(playerId, ready);
    },
    [session],
  );

  const addPlayer = useCallback(() => {
    const bi = buyInRef.current;
    if (buyInTimerRef.current) clearTimeout(buyInTimerRef.current);
    setBuyIn(bi);
    createSession(playerCountRef.current + 1, bi);
  }, [createSession]);

  const removePlayer = useCallback(() => {
    const bi = buyInRef.current;
    if (buyInTimerRef.current) clearTimeout(buyInTimerRef.current);
    setBuyIn(bi);
    createSession(playerCountRef.current - 1, bi);
  }, [createSession]);

  const resetSession = useCallback(() => {
    createSession(playerCountRef.current, buyInRef.current);
  }, [createSession]);

  // Derived values
  const { status, games, wins, playerConfigs } = snapshot;
  const potSats = buyIn * snapshot.playerCount;
  const aliveCount = games.filter((g) => !g.state.isGameOver).length;
  const showIntermission = status === 'roundWinner' || status === 'intermission';
  const intermissionPlayers: IntermissionPlayer[] = playerConfigs.map((c, i) => ({
    playerId: c.playerId,
    slotIndex: i,
    playerName: c.displayName,
    ready: true,
    paid: c.paid,
    wins: wins[c.playerId] ?? 0,
  }));

  return {
    buyIn,
    inputBuyIn,
    snapshot,
    invoices,
    invoiceErrors,
    lightningAddresses,
    nwcMissing,
    potSats,
    aliveCount,
    showIntermission,
    intermissionPlayers,
    handleBuyInInput,
    handleAddressChange,
    toggleReady,
    addPlayer,
    removePlayer,
    resetSession,
  };
}
