import { assertEquals } from '@std/assert';

import { releasePlatformOrder } from './platform_order.ts';

Deno.test('earliest release first; undated and date-less platforms after, de-duplicated', () => {
  assertEquals(
    releasePlatformOrder(
      [
        { date: 1_300_000_000, platform: { id: 48 } }, // PS4 later
        { date: 1_100_000_000, platform: { id: 8 } }, // PS2 first
        { platform: { id: 130 } }, // Switch, no date
        { date: 1_200_000_000, platform: { id: 8 } }, // PS2 again (re-release)
      ],
      [{ id: 6 }, { id: 48 }, 167],
    ),
    [8, 48, 130, 6, 167],
  );
});

Deno.test('no data → empty', () => {
  assertEquals(releasePlatformOrder(undefined, undefined), []);
  assertEquals(releasePlatformOrder([{ date: 1 }], [{}]), []);
});
