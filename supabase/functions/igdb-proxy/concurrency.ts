/**
 * At most `max` tasks run at once; the rest wait in order. A finishing task hands
 * its slot STRAIGHT to the next waiter (it never frees it first), so a newcomer can't
 * slip in between and push the count over `max`.
 */
export function createConcurrencyLimiter(max: number) {
  let active = 0;
  const waiters: (() => void)[] = [];
  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (active >= max) {
        // Woken with a slot already counted for us.
        await new Promise<void>((resolve) => waiters.push(resolve));
      } else {
        active++;
      }
      try {
        return await task();
      } finally {
        const next = waiters.shift();
        if (next) next();
        else active--;
      }
    },
    /** For tests. */
    get active() {
      return active;
    },
    get waiting() {
      return waiters.length;
    },
  };
}
