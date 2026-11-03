import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { GameResultCard } from '@/components/search/GameResultCard';
import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCPanel,
  RetroGamingPCSpinner,
  RetroGamingPCTabs,
  type RetroGamingPCTabItem,
} from '@/components/ui';
import { useCompanyDetail } from '@/hooks/useCompany';
import { SearchServiceError } from '@/services/igdb';
import { COMPANY_GAMES_MAX, igdbImageUrl, type IgdbCompanyDetail } from '@/types/igdb';
import { studioGames, studioRoleCounts, type StudioRoleFilter, type StudioSort } from '@/utils/studioGames';

const SORT_TABS: readonly RetroGamingPCTabItem<StudioSort>[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'rating', label: 'Top Rated' },
  { key: 'name', label: 'A–Z' },
];

const DESCRIPTION_PREVIEW = 280;

function StudioHeader({ company }: { company: IgdbCompanyDetail }) {
  const [expanded, setExpanded] = useState(false);
  const long = (company.description?.length ?? 0) > DESCRIPTION_PREVIEW;
  const description =
    company.description && long && !expanded ? `${company.description.slice(0, DESCRIPTION_PREVIEW).trimEnd()}…` : company.description;
  const facts = [
    company.foundedYear ? `Founded ${company.foundedYear}` : null,
    company.parentName ? `Part of ${company.parentName}` : null,
  ].filter(Boolean);

  return (
    <RetroGamingPCPanel title="Studio">
      <View className="gap-2">
        <View className="flex-row gap-3">
          <Thumbnail
            uri={company.logoImageId ? igdbImageUrl(company.logoImageId, 'logo_med') : null}
            fallback={company.name}
            shape="square"
            accessibilityLabel={`${company.name} logo`}
          />
          <View className="flex-1 gap-1">
            <Text className="text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright">{company.name}</Text>
            {facts.length > 0 ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{facts.join(' · ')}</Text> : null}
            <View className="flex-row flex-wrap gap-1">
              {company.developedCount > 0 ? <RetroGamingPCBadge label={`Developer · ${company.developedCount}`} variant="published" /> : null}
              {company.publishedCount > 0 ? <RetroGamingPCBadge label={`Publisher · ${company.publishedCount}`} /> : null}
            </View>
          </View>
        </View>
        {description ? (
          <Text className="text-retrogamingpc-sm leading-[18px] text-retrogamingpc-text">
            {description}
            {long ? (
              <Text onPress={() => setExpanded((v) => !v)} className="text-retrogamingpc-text-bright underline">
                {expanded ? ' Show less' : ' Read more'}
              </Text>
            ) : null}
          </Text>
        ) : null}
      </View>
    </RetroGamingPCPanel>
  );
}

/** A studio (IGDB company): info, then every game it developed or published, each linking to its game page. */
export default function StudioScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const companyId = Number(id);
  const valid = Number.isSafeInteger(companyId) && companyId > 0;
  const detail = useCompanyDetail(valid ? companyId : null);
  const company = detail.data?.company;

  const [role, setRole] = useState<StudioRoleFilter>('all');
  const [sort, setSort] = useState<StudioSort>('newest');
  const games = useMemo(() => (company ? studioGames(company.games, role, sort) : []), [company, role, sort]);
  const counts = useMemo(() => (company ? studioRoleCounts(company.games) : null), [company]);

  const title = company?.name ?? name ?? 'Studio';

  if (!valid || (detail.isError && detail.error instanceof SearchServiceError && detail.error.status === 404)) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Studio not found' }} />
        <RetroGamingPCPanel title="Studio not found">
          <RetroGamingPCAlert message="This studio isn't in the IGDB catalogue." />
        </RetroGamingPCPanel>
      </View>
    );
  }

  if (!company || !counts) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-retrogamingpc-dark p-4">
        <Stack.Screen options={{ title }} />
        {detail.isError ? (
          <RetroGamingPCPanel title="Couldn't load this studio" className="w-full max-w-[420px]">
            <View className="gap-2">
              <RetroGamingPCAlert message={detail.error.message} />
              <View className="flex-row justify-end">
                <RetroGamingPCButton label="Retry" onPress={() => void detail.refetch()} />
              </View>
            </View>
          </RetroGamingPCPanel>
        ) : (
          <RetroGamingPCSpinner size="large" label={`Loading ${name ?? 'studio'}…`} />
        )}
      </View>
    );
  }

  // Only offer the role filter when the studio has both kinds of credit.
  const roleTabs: RetroGamingPCTabItem<StudioRoleFilter>[] =
    counts.developer > 0 && counts.publisher > 0
      ? [
          { key: 'all', label: 'All', count: counts.all },
          { key: 'developer', label: 'Developed', count: counts.developer },
          { key: 'publisher', label: 'Published', count: counts.publisher },
        ]
      : [];

  return (
    <FlatList
      className="flex-1 bg-retrogamingpc-dark"
      contentContainerClassName="gap-2 p-3"
      data={games}
      keyExtractor={(g) => String(g.id)}
      initialNumToRender={8}
      windowSize={7}
      renderItem={({ item }) => (
        <GameResultCard
          game={item}
          note={roleTabs.length > 0 && role === 'all' ? item.roles.map((r) => (r === 'developer' ? 'Developed' : 'Published')).join(' + ') : undefined}
        />
      )}
      ListHeaderComponent={
        <View className="gap-3 pb-1">
          <Stack.Screen options={{ title }} />
          <StudioHeader company={company} />
          <View className="gap-2">
            <Text className="retrogamingpc-label">Games ({company.games.length})</Text>
            {roleTabs.length > 0 ? <RetroGamingPCTabs items={roleTabs} value={role} onChange={setRole} fill /> : null}
            <RetroGamingPCTabs items={SORT_TABS} value={sort} onChange={setSort} />
            {company.gamesTruncated ? (
              <RetroGamingPCAlert tone="info" message={`Showing the first ${COMPANY_GAMES_MAX} credited games.`} />
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <View className="retrogamingpc-bevel-inset items-center bg-retrogamingpc-dark px-4 py-6">
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No catalogue games for this studio yet.</Text>
        </View>
      }
    />
  );
}
