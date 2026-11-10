/**
 * Migration 000045: the light theme joins the saved theme list.
 *   npm run test:sql -- light_theme
 */
import { assertEquals } from '@std/assert';

import { asOwner, freshDb } from './_setup.ts';

Deno.test('the light theme can be saved', async () => {
  const db = await freshDb();
  const [row] = await asOwner<{ themes: string }>(db, 'select enum_range(null::public.ui_theme)::text as themes');
  assertEquals(row!.themes, '{olive,blue,red,yellow,pink,white}');
});
