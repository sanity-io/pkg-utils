# generated fixtures

The identifier tests (`test/identifiers.test.ts`) write throwaway app roots here — each with
its own `package.json` (name and version) and `src/*.css.ts` modules — at the start of every
test, so state leaked by a crashed or timed-out run can't poison later runs. Everything but this
file is gitignored.
