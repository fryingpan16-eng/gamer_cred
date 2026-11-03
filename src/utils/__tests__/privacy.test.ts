import { NOW_PLAYING_VISIBILITIES, NOW_PLAYING_VISIBILITY_OPTIONS } from '@/constants/privacy';
import { nowPlayingHiddenReason } from '@/utils/privacy';

describe('Now Playing visibility (mirrors the migration 000010 RLS policy)', () => {
  const owner = { isOwner: true, isFriend: false };
  const friend = { isOwner: false, isFriend: true };
  const stranger = { isOwner: false, isFriend: false };

  it('owners always see their own slots', () => {
    for (const v of NOW_PLAYING_VISIBILITIES) expect(nowPlayingHiddenReason(v, owner)).toBeNull();
  });

  it('public is visible to everyone', () => {
    expect(nowPlayingHiddenReason('public', friend)).toBeNull();
    expect(nowPlayingHiddenReason('public', stranger)).toBeNull();
  });

  it('friends-only is visible to friends and hidden from everyone else', () => {
    expect(nowPlayingHiddenReason('friends', friend)).toBeNull();
    expect(nowPlayingHiddenReason('friends', stranger)).toBe('friends');
  });

  it('private is hidden even from friends', () => {
    expect(nowPlayingHiddenReason('private', friend)).toBe('private');
    expect(nowPlayingHiddenReason('private', stranger)).toBe('private');
  });

  it('every option has a label, badge and description', () => {
    for (const v of NOW_PLAYING_VISIBILITIES) {
      const o = NOW_PLAYING_VISIBILITY_OPTIONS[v];
      expect(o.label.length && o.badge.length && o.description.length).toBeTruthy();
    }
  });
});
