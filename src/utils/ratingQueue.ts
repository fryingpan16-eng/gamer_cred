/**
 * Per-game save queue for quick ratings: rapid taps on the stars collapse into
 * one save of the LAST value (debounced), saves for the same game never run
 * concurrently (no out-of-order responses), and a failed save reports the last
 * value the server confirmed so the UI can roll back to it.
 *
 * Pure TS (no React / Supabase) so it is unit-tested with fake timers.
 */
export type RatingQueueOptions<V> = {
  delayMs: number;
  /** Persist `value` (null = clear). Rejects on failure. */
  save: (gameId: number, value: V | null) => Promise<void>;
  equals: (a: V | null, b: V | null) => boolean;
  onSaved?: (gameId: number, value: V | null) => void;
  /** Called only when no newer change is queued; `confirmed` is the server's value. */
  onFailed?: (gameId: number, confirmed: V | null, error: unknown) => void;
};

export class RatingQueue<V> {
  private readonly confirmed = new Map<number, V | null>();
  private readonly pending = new Map<number, V | null>();
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly chains = new Map<number, Promise<void>>();
  private readonly inFlight = new Map<number, number>();

  constructor(private readonly options: RatingQueueOptions<V>) {}

  /** True while a change for this game is waiting or being saved. */
  isBusy(gameId: number): boolean {
    return this.pending.has(gameId) || (this.inFlight.get(gameId) ?? 0) > 0;
  }

  /**
   * Queue `value` for `gameId`. `current` is what the UI showed before this
   * change; it is taken as the server's value only when nothing is in progress
   * (otherwise the UI is already showing an optimistic value).
   */
  set(gameId: number, value: V | null, current: V | null): void {
    if (!this.isBusy(gameId)) this.confirmed.set(gameId, current);
    this.pending.set(gameId, value);
    const timer = this.timers.get(gameId);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.set(
      gameId,
      setTimeout(() => void this.flush(gameId), this.options.delayMs),
    );
  }

  /** Save this game's queued value now (after any save already running for it). */
  flush(gameId: number): Promise<void> {
    const timer = this.timers.get(gameId);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(gameId);
    const next = (this.chains.get(gameId) ?? Promise.resolve()).then(() => this.run(gameId));
    this.chains.set(gameId, next);
    return next;
  }

  /** Save everything queued now (e.g. when the screen unmounts). */
  flushAll(): Promise<void> {
    return Promise.all([...this.pending.keys()].map((id) => this.flush(id))).then(() => undefined);
  }

  private async run(gameId: number): Promise<void> {
    if (!this.pending.has(gameId)) return;
    const value = this.pending.get(gameId) ?? null;
    this.pending.delete(gameId);
    const confirmed = this.confirmed.get(gameId) ?? null;
    if (this.options.equals(value, confirmed)) return; // e.g. set then reverted before the save fired

    this.inFlight.set(gameId, (this.inFlight.get(gameId) ?? 0) + 1);
    try {
      await this.options.save(gameId, value);
      this.confirmed.set(gameId, value);
      this.options.onSaved?.(gameId, value);
    } catch (error) {
      // A newer change is queued: it will save (or fail and roll back) on its own.
      if (!this.pending.has(gameId)) this.options.onFailed?.(gameId, confirmed, error);
    } finally {
      this.inFlight.set(gameId, (this.inFlight.get(gameId) ?? 1) - 1);
    }
  }
}
