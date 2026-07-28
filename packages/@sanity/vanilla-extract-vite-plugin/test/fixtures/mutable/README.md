# mutable fixture

The invalidation tests generate `src/styles.css.ts` and (when exercising shared-dependency
edits) `src/theme.ts` here at the start of each test — both gitignored — so state leaked by a
crashed or timed-out run can't poison later runs.
