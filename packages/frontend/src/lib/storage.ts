type StorageSchema = {
  playerName: string;
  lightningAddress: string;
  nwcString: string;
  das_ms: number;
  arr_ms: number;
};

const DEFAULTS: StorageSchema = {
  playerName: '',
  lightningAddress: '',
  nwcString: '',
  das_ms: 167,
  arr_ms: 33,
};

type Key = keyof StorageSchema;
type Value<K extends Key> = StorageSchema[K];

function getRaw(key: Key): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export const storage = {
  get<K extends Key>(key: K): Value<K> {
    const raw = getRaw(key);
    if (raw === null) return DEFAULTS[key];
    const def = DEFAULTS[key];
    if (typeof def === 'number') {
      const n = Number(raw);
      return (Number.isFinite(n) ? n : def) as Value<K>;
    }
    return raw as Value<K>;
  },

  set<K extends Key>(key: K, value: Value<K>): void {
    try { localStorage.setItem(key, String(value)); } catch { /* quota exceeded */ }
  },

  remove(key: Key): void {
    try { localStorage.removeItem(key); } catch { /* */ }
  },
};
