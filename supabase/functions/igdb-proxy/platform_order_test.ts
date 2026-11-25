import { assertEquals } from '@std/assert';

import { LAUNCH_WINDOW_DAYS, launchPlatforms, releasePlatformOrder } from './platform_order.ts';

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

const DAY = 86_400;

Deno.test('launch platforms: everything within the launch window of the first release', () => {
  const t = 1_300_000_000;
  assertEquals(
    launchPlatforms(
      [
        { date: t, platform: { id: 12 } }, // Xbox 360 day one
        { date: t + 30 * DAY, platform: { id: 9 } }, // PS3 a month later: same launch
        { date: t + (LAUNCH_WINDOW_DAYS + 1) * DAY, platform: { id: 6 } }, // PC much later: a port
        { date: t - 10 * DAY + 400 * DAY, platform: { id: 12 } }, // a later 360 re-release doesn't move its first date
        { platform: { id: 48 } }, // undated
      ],
      [{ id: 12 }, { id: 9 }, { id: 6 }, { id: 48 }],
    ),
    [12, 9],
  );
});

Deno.test('launch platforms: no dates → every listed platform; nothing → empty', () => {
  assertEquals(launchPlatforms([{ platform: 7 }], [{ id: 7 }, 4]), [7, 4]);
  assertEquals(launchPlatforms(undefined, undefined), []);
});
