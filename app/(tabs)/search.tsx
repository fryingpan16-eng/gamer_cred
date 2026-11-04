import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ListCard } from '@/components/lists/ListCard';
import { CompanyResultCard } from '@/components/search/CompanyResultCard';
import { CreatorResultCard } from '@/components/search/CreatorResultCard';
import { RawgAttribution } from '@/components/search/RawgAttribution';
import { GameResultCard } from '@/components/search/GameResultCard';
import { SearchResultList } from '@/components/search/SearchResultList';
import { UserResultCard } from '@/components/search/UserResultCard';
import { RetroGamingPCAlert, RetroGamingPCInput, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useGameLookup } from '@/hooks/useGames';
import { useListSearch } from '@/hooks/useLists';
import { listSearchPattern } from '@/services/lists';
import { useCompanySearch, useCreatorSearch, useFriendAction, useGameSearch, useUserSearch } from '@/hooks/useSearch';
import { USER_SEARCH_MIN_LENGTH } from '@/services/users';
import { IGDB_SEARCH_LIMITS, normalizeSearchQuery } from '@/types/igdb';
import type { SearchEntity } from '@/utils/queryKeys';
import { useThemeColors } from '@/hooks/useTheme';

const ENTITY_TABS: readonly RetroGamingPCTabItem<SearchEntity>[] = [
  { key: 'games', label: 'Games' },
  // Short label so all four fit one row on a phone; the sub-tabs split Studios / People.
  { key: 'companies', label: 'Creators' },
  { key: 'users', label: 'Users' },
  { key: 'lists', label: 'Lists' },
];

/** Sub-modes of the "Creators" tab: IGDB companies (studios) vs RAWG people. */
type IndustryMode = 'studios' | 'people';

const INDUSTRY_TABS: readonly RetroGamingPCTabItem<IndustryMode>[] = [
  { key: 'studios', label: 'Studios' },
  { key: 'people', label: 'Directors & People' },
];

const PLACEHOLDERS: Record<SearchEntity, string> = {
  games: 'Search games by title…',
  companies: 'Search studios, developers, publishers…',
  users: 'Search players by permanent name…',
  lists: 'Search lists by title or description…',
};
const PEOPLE_PLACEHOLDER = 'Search directors, writers, composers…';

const SEARCH_DEBOUNCE_MS = 350;

type ResultsProps = { term: string; typing: boolean };

function isActive(term: string, entity: SearchEntity): boolean {
  if (entity === 'lists') return listSearchPattern(term) !== null;
  return entity === 'users'
    ? term.trim().length >= USER_SEARCH_MIN_LENGTH
    : normalizeSearchQuery(term).length >= IGDB_SEARCH_LIMITS.minQueryLength;
}

// Each results pane owns its query hook; only the visible tab's pane is mounted,
// so typing never fires searches for hidden tabs (protects the IGDB rate limit).

function GameResults({ term, typing }: ResultsProps) {
  const query = useGameSearch(term);
  return (
    <SearchResultList
      query={query}
      items={query.data?.results}
      term={term}
      active={isActive(term, 'games')}
      typing={typing}
      idleHint="Find games by title via the IGDB database."
      loadingLabel="Searching IGDB…"
      statusNote={query.data?.cached ? 'cached' : undefined}
      keyExtractor={(g) => String(g.id)}
      renderItem={(g) => <GameResultCard game={g} />}
    />
  );
}

function CompanyResults({ term, typing }: ResultsProps) {
  const query = useCompanySearch(term);
  return (
    <SearchResultList
      query={query}
      items={query.data?.results}
      term={term}
      active={isActive(term, 'companies')}
      typing={typing}
      idleHint="Find developers and publishers."
      loadingLabel="Searching studios…"
      statusNote={query.data?.cached ? 'cached' : undefined}
      keyExtractor={(c) => String(c.id)}
      renderItem={(c) => <CompanyResultCard company={c} />}
    />
  );
}

function PeopleResults({ term, typing, onSearchGames }: ResultsProps & { onSearchGames: (title: string) => void }) {
  const query = useCreatorSearch(term);
  return (
    <SearchResultList
      query={query}
      items={query.data?.results}
      term={term}
      active={isActive(term, 'companies')}
      typing={typing}
      idleHint="Find directors, writers, composers and other game creators."
      loadingLabel="Searching creators…"
      statusNote={query.data?.cached ? 'cached' : undefined}
      keyExtractor={(c) => String(c.id)}
      renderItem={(c) => <CreatorResultCard creator={c} onSearchGames={onSearchGames} />}
      footer={<RawgAttribution />}
    />
  );
}

function UserResults({ term, typing }: ResultsProps) {
  const query = useUserSearch(term);
  const friendAction = useFriendAction();
  const pendingKey = friendAction.isPending
    ? friendAction.variables.action === 'send'
      ? friendAction.variables.friendId
      : friendAction.variables.friendshipId
    : null;

  return (
    <View className="flex-1">
      {friendAction.isError ? (
        <View className="px-3 pt-3">
          <RetroGamingPCAlert message={friendAction.error.message} />
        </View>
      ) : null}
      <SearchResultList
        query={query}
        items={query.data}
        term={term}
        active={isActive(term, 'users')}
        typing={typing}
        idleHint="Find community members and send friend requests."
        loadingLabel="Searching players…"
        keyExtractor={(u) => u.id}
        renderItem={(u) => (
          <UserResultCard
            user={u}
            pending={
              pendingKey !== null &&
              (pendingKey === u.id || ('friendshipId' in u.relation && u.relation.friendshipId === pendingKey))
            }
            onSendRequest={(friendId) => friendAction.mutate({ action: 'send', friendId })}
            onRespond={(friendshipId, accept) =>
              friendAction.mutate({ action: accept ? 'accept' : 'decline', friendshipId })
            }
          />
        )}
      />
    </View>
  );
}

function ListResults({ term, typing }: ResultsProps) {
  const query = useListSearch(term);
  const lists = query.data;
  const games = useGameLookup((lists ?? []).flatMap((l) => l.previewGameIds));
  return (
    <SearchResultList
      query={query}
      items={lists}
      term={term}
      active={isActive(term, 'lists')}
      typing={typing}
      idleHint="Find public game lists made by the community."
      loadingLabel="Searching lists…"
      keyExtractor={(l) => l.id}
      extraData={games.data}
      renderItem={(l) => <ListCard list={l} games={games.data} />}
    />
  );
}

export default function SearchScreen() {
  const themeColors = useThemeColors();
  // ?tab=lists (e.g. Home → Your Lists → Browse) opens that tab.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [entity, setEntity] = useState<SearchEntity>(ENTITY_TABS.some((t) => t.key === tab) ? (tab as SearchEntity) : 'games');
  const [lastTab, setLastTab] = useState(tab);
  if (tab !== lastTab) {
    setLastTab(tab);
    if (ENTITY_TABS.some((t) => t.key === tab)) setEntity(tab as SearchEntity);
  }
  const [industryMode, setIndustryMode] = useState<IndustryMode>('studios');
  const [term, setTerm] = useState('');
  const debouncedTerm = useDebouncedValue(term, SEARCH_DEBOUNCE_MS);
  const typing = term !== debouncedTerm;

  const searchGamesFor = useCallback((name: string) => {
    setEntity('games');
    setTerm(name);
  }, []);

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      {/* Same header strip as Home: full-width folder tabs, then the search box. */}
      <View className="gap-2 border-b border-b-retrogamingpc-accent px-3 pt-3 pb-2">
        <RetroGamingPCTabs items={ENTITY_TABS} value={entity} onChange={setEntity} fill />
        <RetroGamingPCInput
          value={term}
          onChangeText={setTerm}
          placeholder={entity === 'companies' && industryMode === 'people' ? PEOPLE_PLACEHOLDER : PLACEHOLDERS[entity]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={IGDB_SEARCH_LIMITS.maxQueryLength}
          accessibilityLabel={`Search ${ENTITY_TABS.find((t) => t.key === entity)?.label ?? entity}`}
          icon={<Feather name="search" size={12} color={themeColors.textMuted} />}
          trailing={
            term.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setTerm('')}>
                <Feather name="x" size={12} color={themeColors.textMuted} />
              </Pressable>
            ) : null
          }
        />
        {entity === 'companies' ? (
          <RetroGamingPCTabs items={INDUSTRY_TABS} value={industryMode} onChange={setIndustryMode} fill />
        ) : null}
      </View>

      <View className="flex-1">
        {entity === 'games' ? <GameResults term={debouncedTerm} typing={typing} /> : null}
        {entity === 'companies' && industryMode === 'studios' ? (
          <CompanyResults term={debouncedTerm} typing={typing} />
        ) : null}
        {entity === 'companies' && industryMode === 'people' ? (
          <PeopleResults term={debouncedTerm} typing={typing} onSearchGames={searchGamesFor} />
        ) : null}
        {entity === 'users' ? <UserResults term={debouncedTerm} typing={typing} /> : null}
        {entity === 'lists' ? <ListResults term={debouncedTerm} typing={typing} /> : null}
      </View>
    </View>
  );
}
