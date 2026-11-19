// A plain JS module exporting a function — NOT a vanilla-extract module — whose file name matches
// vanilla-extract's `cssFileFilter`, like the `*.css.js` style helpers (`createDialogStyles`, …)
// that `@sentry/feedback` 11.13+ ships next to its other build output.
const createFunctionStyles = (nonce) =>
  `.function-css-js-dependency{color:rgb(211, 212, 213)}/* ${nonce} */`
export {createFunctionStyles}
