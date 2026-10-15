/**
 * Options for the generated `package.json` CSS export.
 *
 * @public
 */
export interface CssExportsOptions {
  /**
   * Emit a Node.js-compatible CSS entry point.
   *
   * When enabled, the plugin writes a `bundle-css.js` shim and a matching `bundle-css.d.ts`
   * declaration next to the CSS asset, and `tsdown` publishes `./bundle.css` as a conditional
   * export: bundlers that understand CSS imports resolve the stylesheet directly, while Node.js
   * resolves the empty shim so the CSS import never throws on the server.
   *
   * @defaultValue false
   */
  nodeCompat?: boolean
}

/**
 * The resolved CSS export settings.
 *
 * @public
 */
export interface ResolvedCssExportOptions {
  /** Whether the entry chunks import the generated CSS file. */
  inject: boolean
  /** Whether a `package.json` export is added for the generated CSS file. */
  exports: boolean
  /** Whether the Node.js-compatible shim is emitted next to the CSS file. */
  nodeCompat: boolean
}

/**
 * Resolves the `inject` and `exports` options into their effective values.
 *
 * @public
 */
export function resolveCssExportOptions(options: {
  inject?: boolean
  exports?: boolean | CssExportsOptions
}): ResolvedCssExportOptions {
  const {inject, exports} = options
  return {
    inject: Boolean(inject),
    exports: exports !== false && exports !== undefined,
    nodeCompat: typeof exports === 'object' ? (exports.nodeCompat ?? false) : false,
  }
}
