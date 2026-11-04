import { assertEquals } from '@std/assert';

import { createConcurrencyLimiter } from './concurrency.ts';

const tick = () => new Promise((r) => setTimeout(r, 0));

Deno.test('never runs more than max at once, even when newcomers arrive as a slot frees', async () => {
  const limiter = createConcurrencyLimiter(2);
  let running = 0;
  let peak = 0;
  const releases: (() => void)[] = [];
  const task = () =>
    limiter.run(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise<void>((r) => releases.push(r));
      running--;
    });

  const all = [task(), task(), task()]; // third waits
  await tick();
  assertEquals([running, limiter.waiting], [2, 1]);

  releases.shift()!(); // one finishes and hands its slot to the waiter…
  all.push(task()); // …while a newcomer arrives in the same moment
  await tick();
  assertEquals(running <= 2, true);
  assertEquals(peak, 2);

  while (releases.length) {
    releases.shift()!();
    await tick();
  }
  await Promise.all(all);
  assertEquals([limiter.active, limiter.waiting, peak], [0, 0, 2]);
});

Deno.test('a failing task still frees its slot', async () => {
  const limiter = createConcurrencyLimiter(1);
  await limiter.run(() => Promise.reject(new Error('x'))).catch(() => undefined);
  assertEquals(await limiter.run(async () => 'ok'), 'ok');
  assertEquals(limiter.active, 0);
});
