# Name rules

Source lists for the permanent-name and display-name checks (migration 000038).
`python3 scripts/generate-name-rules.py` turns them into a migration
(`000039_name_rules_data.sql`). Edit these files, not the SQL.

Matching ignores capitals, spaces, symbols, accents, repeated letters,
number swaps (4→a, 0→o, 1→i, 3→e, 5→s, 7→t, 8→b) and look-alike Cyrillic or
Greek letters.

| File | Rule |
|---|---|
| `staff.txt`, `game_industry.txt`, `creators.txt`, `celebrities.txt`, `politicians.txt`, `companies.txt` | Reserved: blocked as the whole name, or with impersonation add-ons ("TheReal…", "…Official", "…TV", "…HQ"). Fan names like "KojimaFan" stay allowed. Use full names or names nobody else has; a common first name alone would block ordinary players. |
| `badwords.txt` | `word anywhere` = blocked even inside a longer name ("Chinkdude"); `word whole` = only as its own word (for short words hiding in everyday ones, like "ass" in "class"). |
| `allowed_words.txt` | Everyday words that contain an `anywhere` word ("raccoon", "spicy", "Scunthorpe"). They are taken out before the check. |

To release a reserved name for one account (e.g. the real person joined):

```sql
insert into private.name_exceptions (user_id, name_key)
values ('<profile id>', private.name_key('Their Name'));
```
