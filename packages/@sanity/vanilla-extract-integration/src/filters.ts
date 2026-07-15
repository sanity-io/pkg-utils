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
