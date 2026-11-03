import { Text, View } from 'react-native';

import { RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCCard } from '@/components/ui';
import { igdbImageUrl, type IgdbCompanyResult } from '@/types/igdb';

import { Thumbnail } from './Thumbnail';

type CompanyResultCardProps = {
  company: IgdbCompanyResult;
  /** Jump to the Games tab searching this studio's name. */
  onSearchGames: (name: string) => void;
};

export function CompanyResultCard({ company, onSearchGames }: CompanyResultCardProps) {
  return (
    <RetroGamingPCCard className="flex-row gap-3">
      <Thumbnail
        uri={company.logoImageId ? igdbImageUrl(company.logoImageId, 'logo_med') : null}
        fallback={company.name}
        shape="square"
        accessibilityLabel={`${company.name} logo`}
      />
      <View className="flex-1 gap-1">
        <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
          {company.name}
        </Text>
        {company.foundedYear ? (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Founded {company.foundedYear}</Text>
        ) : null}
        <View className="flex-row flex-wrap gap-1">
          {company.developedCount > 0 ? <RetroGamingPCBadge label={`Developer · ${company.developedCount}`} variant="published" /> : null}
          {company.publishedCount > 0 ? <RetroGamingPCBadge label={`Publisher · ${company.publishedCount}`} /> : null}
        </View>
        {company.description ? (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={2}>
            {company.description}
          </Text>
        ) : null}
        <View className="flex-row justify-end pt-1">
          <RetroGamingPCButton variant="navigate" label="Search Games" onPress={() => onSearchGames(company.name)} />
        </View>
      </View>
    </RetroGamingPCCard>
  );
}
