import { useState } from 'react';

import { RetroGamingPCButton } from '@/components/ui';
import { platformInfo } from '@/constants/platforms';
import { useMemberId } from '@/hooks/useAuth';
import { useMyLibraryCopies } from '@/hooks/useLibrary';

import { LibraryGameModal, type LibraryGameRef } from './LibraryGameModal';

/**
 * + Library / ✓ In Library (game page and search results). Opens the platform
 * dialog: add the platforms you own it on, change format, or remove copies.
 * Members only; owning a game never touches its rating or your backlog.
 */
export function LibraryButton({ game, compact = false }: { game: LibraryGameRef; compact?: boolean }) {
  const viewerId = useMemberId();
  const { copies, isPending } = useMyLibraryCopies(game.id);
  const [open, setOpen] = useState(false);
  if (!viewerId) return null;
  const owned = copies.length > 0;
  const platforms = copies.map((c) => platformInfo(c.platformId).short).join(', ');
  return (
    <>
      <RetroGamingPCButton
        variant={owned ? 'default' : 'create'}
        label={owned ? (compact ? '✓ Library' : '✓ In Library') : '+ Library'}
        accessibilityLabel={owned ? `${game.name} is in your library (${platforms}). Change platforms` : `Add ${game.name} to your library`}
        accessibilityState={{ selected: owned }}
        disabled={isPending}
        onPress={() => setOpen(true)}
      />
      {open ? <LibraryGameModal game={game} visible onClose={() => setOpen(false)} /> : null}
    </>
  );
}
