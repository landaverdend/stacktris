export class Emitter<EventMap extends Record<string, unknown>> {
  private subscribers = new Map<keyof EventMap, Set<(val: any) => void>>();

  subscribe<K extends keyof EventMap>(event: K, fn: (val: EventMap[K]) => void): () => void {
    if (!this.subscribers.has(event)) this.subscribers.set(event, new Set());
    this.subscribers.get(event)!.add(fn);
    return () => this.subscribers.get(event)?.delete(fn);
  }

  emit<K extends keyof EventMap>(event: K, val: EventMap[K]): void {
    this.subscribers.get(event)?.forEach(fn => fn(val));
  }
}
