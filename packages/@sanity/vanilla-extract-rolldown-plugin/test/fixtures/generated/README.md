# generated fixtures

The identifier tests (`test/identifiers.test.ts`) write throwaway fixture packages here — each
with its own `package.json` (name and version), an `index.ts` entry and a `.css.ts` module — at
the start of every test, so state leaked by a crashed or timed-out run can't poison later runs.
Everything but this file is gitignored.
