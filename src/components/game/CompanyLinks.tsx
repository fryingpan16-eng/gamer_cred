import { router } from 'expo-router';
import { Fragment } from 'react';
import { Text } from 'react-native';

import type { CompanyRef } from '@/types/igdb';

/** Opens a company's studio page (every game it developed or published). */
export function openStudio(company: CompanyRef) {
  router.push({ pathname: '/studio/[id]', params: { id: String(company.id), name: company.name } });
}

/**
 * Comma-separated company names, each a link to its studio page. Nest it inside
 * a <Text> (it inherits that text's size). Falls back to plain names when the
 * ids are missing (a game page loaded before the proxy sent them).
 */
export function CompanyLinks({ companies, fallback }: { companies: readonly CompanyRef[] | undefined; fallback: readonly string[] }) {
  if (!companies || companies.length === 0) return <Text>{fallback.join(', ')}</Text>;
  return (
    <Text>
      {companies.map((c, i) => (
        <Fragment key={c.id}>
          {i > 0 ? ', ' : null}
          <Text
            accessibilityRole="link"
            accessibilityLabel={`${c.name}. Open studio page`}
            onPress={() => openStudio(c)}
            className="text-retrogamingpc-text-bright underline"
          >
            {c.name}
          </Text>
        </Fragment>
      ))}
    </Text>
  );
}
