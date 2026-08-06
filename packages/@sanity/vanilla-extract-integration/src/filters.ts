/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK).
 */

// Vite adds a "?used" to CSS files it detects, this isn't relevant for
// .css.ts files but it's added anyway so we need to allow for it in the file match
/**
 * Matches vanilla-extract `.css.{js,cjs,mjs,jsx,ts,tsx}` module ids.
 * @public
 */
export const cssFileFilter: RegExp = /\.css\.(js|cjs|mjs|jsx|ts|tsx)(\?used)?$/

/**
 * Matches the virtual `.vanilla.css` module ids emitted by {@link processVanillaFile}, which
 * carry their CSS in a serialized `?source=` query.
 * @public
 */
export const virtualCssFileFilter: RegExp = /\.vanilla\.css\?source=.*$/

/**
 * True when `source` looks like a vanilla-extract module (imports any `@vanilla-extract/…`
 * package). {@link cssFileFilter} alone is not enough: packages such as `@bynder/compact-view`
 * ship plain JS modules named `Styles.css.js` that match the filter but are not
 * vanilla-extract — processing them injects `@vanilla-extract/css/adapter` / `fileScope` and
 * then fails under pnpm when those packages cannot be resolved from the dependency's nested
 * `node_modules`.
 * @public
 */
export function isVanillaExtractSource(source: string): boolean {
  return source.includes('@vanilla-extract/')
}
