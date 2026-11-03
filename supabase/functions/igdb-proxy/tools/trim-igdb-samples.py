"""Trim live IGDB probe output into the curation test fixtures (curation fields only, no secrets).

Usage (from supabase/functions/igdb-proxy):
  python3 tools/trim-igdb-samples.py /path/to/igdb-samples.json            # → fixtures/igdb-samples.json
  python3 tools/trim-igdb-samples.py --probe /path/to/igdb-fangame-probe.json  # → fixtures/igdb-fangame-probe.json
"""
import json
import sys

GAME_KEYS = [
    'id', 'name', 'game_type', 'version_parent', 'parent_game', 'first_release_date', 'bundles',
    'total_rating_count', 'external_games', 'involved_companies',
]
CHILD_KEYS = ['id', 'name', 'game_type', 'version_parent', 'parent_game', 'collections', 'franchises', 'involved_companies']


def pick(obj, keys):
    out = {k: obj[k] for k in keys if k in obj}
    if isinstance(out.get('parent_game'), dict):
        out['parent_game'] = {k: out['parent_game'][k] for k in ('id', 'name') if k in out['parent_game']}
    if 'involved_companies' in out:
        out['involved_companies'] = [
            {
                'developer': bool(ic.get('developer')),
                'publisher': bool(ic.get('publisher')),
                # keep the company id (+ name when expanded): the filter compares ids
                'company': (
                    {k: ic['company'][k] for k in ('id', 'name') if k in ic['company']}
                    if isinstance(ic['company'], dict)
                    else ic['company']
                ),
            }
            for ic in out['involved_companies']
            if 'company' in ic
        ]
    if 'external_games' in out:
        out['external_games'] = sorted(
            ({'external_game_source': e['external_game_source']} for e in out['external_games'] if 'external_game_source' in e),
            key=lambda e: e['external_game_source'],
        )
    return out


def body(res):
    return res['body'] if isinstance(res.get('body'), list) else []


def trim_samples(path):
    d = json.load(open(path))
    games = {}
    for res in d['samples'].values():
        for g in body(res):
            games[g['id']] = pick(g, GAME_KEYS)
    children = {}
    for bundle_id, res in d['bundle_children'].items():
        for c in body(res):
            entry = children.setdefault(c['id'], pick(c, CHILD_KEYS))
            entry.setdefault('bundles', [])
            if int(bundle_id) not in entry['bundles']:
                entry['bundles'].append(int(bundle_id))
    fixture = {
        '_note': f"Live IGDB payloads captured {d['fetched_at']} (trimmed to curation fields). Regenerate with tools/igdb-verify.mjs.",
        'game_types': [{'id': t['id'], 'type': t['type']} for t in d['game_types']['body']],
        'games': sorted(games.values(), key=lambda g: g['id']),
        'bundle_children': sorted(children.values(), key=lambda c: c['id']),
        'bundle_ids': sorted(int(b) for b in d['bundle_children']),
    }
    json.dump(fixture, open('fixtures/igdb-samples.json', 'w'), indent=2, ensure_ascii=False)
    print(f"{len(fixture['games'])} games, {len(fixture['bundle_children'])} bundle children, {len(fixture['bundle_ids'])} bundles")


def trim_probe(path):
    p = json.load(open(path))
    probe = {
        '_note': f"Live IGDB searches captured {p['fetched_at']} for tuning the fan-game filter. Regenerate with tools/igdb-fangame-probe.mjs.",
        'searches': {q: {'group': res['group'], 'games': [pick(g, GAME_KEYS) for g in body(res)]} for q, res in p['searches'].items()},
    }
    json.dump(probe, open('fixtures/igdb-fangame-probe.json', 'w'), indent=1, ensure_ascii=False)
    print(f"probe: {sum(len(s['games']) for s in probe['searches'].values())} games in {len(probe['searches'])} searches")


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--probe':
        trim_probe(sys.argv[2])
    elif len(sys.argv) == 2:
        trim_samples(sys.argv[1])
    else:
        print(__doc__)
        sys.exit(1)
