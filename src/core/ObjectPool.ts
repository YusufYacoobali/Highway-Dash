/**
 * Fixed-shape recycling pool. The engine spawns hundreds of vehicles and coins
 * per run; allocating them lazily and reusing them keeps the GC quiet enough
 * to hold 60 fps on mid-range Android hardware.
 */
export class ObjectPool<T> {
  private readonly idle: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly onAcquire?: (item: T) => void,
    private readonly onRelease?: (item: T) => void,
  ) {}

  acquire(): T {
    const item = this.idle.pop() ?? this.factory();
    this.onAcquire?.(item);
    return item;
  }

  release(item: T): void {
    this.onRelease?.(item);
    this.idle.push(item);
  }

  /** Every object ever created by this pool that is currently idle. */
  get idleItems(): readonly T[] {
    return this.idle;
  }

  clear(): void {
    this.idle.length = 0;
  }
}
