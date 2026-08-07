export type Unsubscribe = () => void;

/**
 * Minimal typed pub/sub. The engine publishes gameplay events; React features
 * subscribe to them. Neither side imports the other, which is what lets the
 * engine run headless in tests.
 */
export class Emitter<EventMap> {
  private readonly listeners = new Map<keyof EventMap, Set<(payload: never) => void>>();

  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): Unsubscribe {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (payload: never) => void);
    this.listeners.set(event, set);
    return () => {
      set.delete(listener as (payload: never) => void);
    };
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as (value: EventMap[K]) => void)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
