# generated fixtures

The identifier tests (`test/identifiers.test.ts`) write throwaway fixture packages here — each
with its own `package.json` (name and version) and `.css.ts` modules — at the start of every
test, so state leaked by a crashed or timed-out run can't poison later runs. Everything but this
file is gitignored.

The fixtures live inside the package (rather than in the OS temp directory) so the evaluated
modules resolve the same `@vanilla-extract/css` instance the tests do.
