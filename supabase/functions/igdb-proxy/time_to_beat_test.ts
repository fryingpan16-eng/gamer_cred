import { assertEquals } from '@std/assert';

import { mapTimeToBeat } from './time_to_beat.ts';

Deno.test('mapTimeToBeat: tiers in seconds, bad values dropped, empty → null', () => {
  assertEquals(mapTimeToBeat({ hastily: 43200.4, normally: 64800, completely: 108000, count: 57 }), {
    main: 43200,
    extras: 64800,
    complete: 108000,
    count: 57,
  });
  assertEquals(mapTimeToBeat({ hastily: 0, normally: 3600, completely: -5, count: null }), {
    main: null,
    extras: 3600,
    complete: null,
    count: 0,
  });
  assertEquals(mapTimeToBeat({ hastily: null, normally: 0, count: 3 }), null);
  assertEquals(mapTimeToBeat(undefined), null);
});
