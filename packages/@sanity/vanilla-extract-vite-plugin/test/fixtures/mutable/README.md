# mutable fixture

The invalidation tests generate `src/styles.css.ts` (gitignored) here at the start of each test,
so state leaked by a crashed or timed-out run can't poison later runs.
