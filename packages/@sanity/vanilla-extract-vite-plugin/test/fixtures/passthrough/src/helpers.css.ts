/**
 * Not a vanilla-extract module, though its name matches the `.css.ts` filter: a function
 * exporting style helper, shaped like the `*.css.js` files `@sentry/feedback` 11.13+ ships.
 */
export const createHelperStyles = (nonce: string): string =>
  `.passthrough-helper{color:rgb(7, 8, 9)}/* ${nonce} */`
