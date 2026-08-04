/**
 * The no-op JS shim file name for a CSS file under vanilla-extract compat mode.
 *
 * `bundle.css` → `bundle-css.js` — deliberately not `${cssFileName}.js` (`bundle.css.js`),
 * which vanilla-extract's `cssFileFilter` (`/\.css\.(js|cjs|mjs|jsx|ts|tsx)$/`) would treat as
 * a stylesheet module. Kept in sync with `cssShimFileName` in
 * `@sanity/vanilla-extract-rolldown-plugin`.
 *
 * @internal
 */
export function cssShimFileName(cssFileName: string): string {
  return `${cssFileName.replace(/\.css$/, '-css')}.js`
}

/**
 * The `.d.ts` companion for {@link cssShimFileName}. `bundle.css` → `bundle-css.d.ts`.
 *
 * @internal
 */
export function cssShimDtsFileName(cssFileName: string): string {
  return `${cssFileName.replace(/\.css$/, '-css')}.d.ts`
}
