# mutable-program fixture

The whole-program tests generate this fixture (`package.json`, `index.html`, `src/theme.ts`,
`src/layout.css.ts`, `src/overrides.css.ts`, `src/main.ts`) at the start of each test — all
gitignored — so state leaked by a crashed or timed-out run can't poison later runs.
