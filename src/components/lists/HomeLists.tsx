import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCreateList, useIsAdmin, useListSearch, usePinnedLists, useRecentLists, useUserLists } from '@/hooks/useLists';
import { listSearchPattern } from '@/services/lists';

import { ListCards } from './ListCard';
import { ListEditorModal } from './ListEditorModal';

/** "+ New List" → editor → the new list's page with the game picker open. */
export function NewListButton({ label = 'New List' }: { label?: string }) {
  const create = useCreateList();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  return (
    <>
      <RetroGamingPCButton variant="create" label={label} onPress={() => setOpen(true)} />
      <ListEditorModal
        visible={open}
        allowSmart={isAdmin.data === true}
        saving={create.isPending}
        error={create.isError ? create.error.message : null}
        onClose={() => setOpen(false)}
        onSave={(values) =>
          create.mutate(values, {
            onSuccess: (id) => {
              setOpen(false);
              // Smart lists fill themselves; others open with the game picker.
              router.push({ pathname: '/list/[id]', params: values.smartRule ? { id } : { id, add: '1' } });
            },
          })
        }
      />
    </>
  );
}

/** Admin-curated lists (pinned to Home), in pinned order. */
export function FeaturedListsPanel() {
  const pinned = usePinnedLists();
  return (
    <RetroGamingPCPanel title="Curated Lists">
      {pinned.isPending ? (
        <RetroGamingPCSpinner label="Loading curated lists…" />
      ) : pinned.isError ? (
        <RetroGamingPCAlert message={pinned.error.message} />
      ) : pinned.data.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          Hand-picked lists from the GamerCred team will appear here.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ListCards lists={pinned.data} layout="tile" />
        </ScrollView>
      )}
    </RetroGamingPCPanel>
  );
}

/** The viewer's own lists, with New List. */
export function YourListsPanel() {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const mine = useUserLists(viewerId);
  return (
    <RetroGamingPCPanel title={`Your Lists${mine.data ? ` (${mine.data.length})` : ''}`} headerRight={<NewListButton />}>
      {mine.isPending ? (
        <RetroGamingPCSpinner label="Loading your lists…" />
      ) : mine.isError ? (
        <RetroGamingPCAlert message={mine.error.message} />
      ) : mine.data.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          Make a list of games: a top 10, a backlog, the best co-op nights. Title it, describe it, then search for games to add.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ListCards lists={mine.data} layout="tile" showOwner={false} />
        </ScrollView>
      )}
    </RetroGamingPCPanel>
  );
}

/** Browse community lists: recently updated by default, or search by title / description. */
export function ListBrowser() {
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 350);
  const searching = listSearchPattern(debounced) !== null;
  const search = useListSearch(debounced);
  const recent = useRecentLists();
  const query = searching ? search : recent;
  const lists = query.data ?? [];

  return (
    <RetroGamingPCPanel title="Browse Lists">
      <View className="gap-2">
        <RetroGamingPCInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search lists by title or description…"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search lists"
        />
        <Text className="retrogamingpc-label">{searching ? `Results for “${debounced.trim()}”` : 'Recently updated'}</Text>
        {query.isPending ? (
          <RetroGamingPCSpinner label={searching ? 'Searching lists…' : 'Loading lists…'} />
        ) : query.isError ? (
          <RetroGamingPCAlert message={query.error.message} />
        ) : lists.length === 0 ? (
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
            {searching ? 'No public lists match that.' : 'No community lists yet. Be the first to make one!'}
          </Text>
        ) : (
          <ListCards lists={lists} />
        )}
      </View>
    </RetroGamingPCPanel>
  );
}
