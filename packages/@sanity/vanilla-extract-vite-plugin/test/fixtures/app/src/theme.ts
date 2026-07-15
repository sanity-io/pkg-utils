/**
 * A plain (non-vanilla-extract) module imported by `styles.css.ts`, so the tests can assert
 * that edits to transitive dependencies invalidate the compiled CSS and that the importer tree
 * is reconstructed from the compiler's module graph.
 */
export const accentColor: string = 'rgb(1, 2, 3)'
