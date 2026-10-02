/** Bounded transport concurrency, never a lifetime coverage limit. Public
 * metadata may be shared; callers only read keys belonging to their profile. */
export class ProgressiveCache<T> {
  private queue: string[] = [];
  private pending = new Map<string, Promise<void>>();
  private finish = new Map<string, () => void>();
  private retryAt = new Map<string, number>();
  private active = 0;
  generation = 0;
  constructor(private readCached: (key: string) => T | undefined,
    private writeCached: (key: string, value: T) => void,
    private fetchValue: (key: string) => Promise<T | null>, private concurrency = 2) {}

  async read(keys: string[], budgetMs = 1200): Promise<Map<string, T>> {
    const unique = [...new Set(keys)];
    for (const key of unique) {
      if (this.readCached(key) !== undefined || this.pending.has(key) || (this.retryAt.get(key) ?? 0) > Date.now()) continue;
      this.pending.set(key, new Promise<void>((resolve) => this.finish.set(key, resolve)));
      this.queue.push(key);
    }
    this.pump();
    const available = () => new Map(unique.flatMap((key) => {
      const value = this.readCached(key);
      return value === undefined ? [] : [[key, value] as const];
    }));
    if (available().size === 0 && budgetMs > 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.all(unique.slice(0, this.concurrency).map((key) => this.pending.get(key))),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, budgetMs); }),
      ]);
      if (timer) clearTimeout(timer);
    }
    return available();
  }

  hasPending(keys: string[]): boolean { return keys.some((key) => this.pending.has(key)); }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const key = this.queue.shift()!;
      this.active++;
      void this.fetchValue(key).then((value) => {
        if (value !== null) { this.writeCached(key, value); this.generation++; }
        else this.retryAt.set(key, Date.now() + 60_000);
      }).catch(() => { this.retryAt.set(key, Date.now() + 60_000); }).finally(() => {
        this.finish.get(key)?.(); this.finish.delete(key); this.pending.delete(key);
        this.active--;
        setImmediate(() => this.pump());
      });
    }
  }
}
