/**
 * Options for the {@link Options.exports | `exports`} option: publishing the extracted CSS file
 * as an export subpath of the package.
 * @public
 */
export interface CssExportsOptions {
  /**
   * Also make the export subpath resolve in runtimes that cannot load `.css` files (Node,
   * Deno, Bun, SSR bundlers, …): a no-op JS shim (e.g. `bundle-css.js`) and its declaration
   * file (`bundle-css.d.ts`) are emitted next to the CSS, and the export becomes a conditional
   * one whose `browser`/`style` conditions point at the stylesheet while `node`/`default`
   * point at the shim.
   *
   * Without it the export is a plain `"./<fileName>": "./<outDir>/<fileName>"` string, which
   * is enough for browser-only packages but throws in Node.
   * @defaultValue false
   */
  nodeCompat?: boolean
}

/**
 * The `inject`/`exports` options resolved into the flags the plugin acts on.
 * @internal
 */
export interface ResolvedCssExportOptions {
  /** Prepend an import of the CSS file to entry chunks that use it. */
  inject: boolean
  /**
   * The CSS file is published as the `"./<fileName>"` export subpath, so injected imports use
   * the self-referential `"<pkg>/<fileName>"` bare specifier and the CSS file is emitted even
   * when it is empty (the export has to resolve either way).
   */
  exports: boolean
  /** Emit the no-op JS shim and its declaration file, for the conditional export. */
  nodeCompat: boolean
  /** The deprecated `inject: {nodeCompat: true}` spelling was used. */
  deprecatedInjectNodeCompat: boolean
}

/**
 * Resolves the {@link Options.inject | `inject`} and {@link Options.exports | `exports`}
 * options, applying the compatibility mapping for the deprecated `inject: {nodeCompat: true}`
 * spelling: it means `{inject: true, exports: {nodeCompat: true}}`. An explicit `exports`
 * always wins over it.
 * @internal
 */
export function resolveCssExportOptions(options: {
  inject?: boolean | {nodeCompat?: boolean}
  exports?: boolean | CssExportsOptions
}): ResolvedCssExportOptions {
  const deprecatedInjectNodeCompat =
    typeof options.inject === 'object' &&
    options.inject !== null &&
    options.inject.nodeCompat === true

  // `inject` is truthy for both its boolean and (now deprecated) object forms
  const inject = Boolean(options.inject)

  if (options.exports !== undefined) {
    const exportsOption = options.exports
    return {
      inject,
      exports: exportsOption !== false,
      nodeCompat: typeof exportsOption === 'object' ? (exportsOption.nodeCompat ?? false) : false,
      deprecatedInjectNodeCompat,
    }
  }

  return {
    inject,
    exports: deprecatedInjectNodeCompat,
    nodeCompat: deprecatedInjectNodeCompat,
    deprecatedInjectNodeCompat,
  }
}

/**
 * The warning shown once per build when the deprecated `inject: {nodeCompat: true}` spelling is
 * used, shared by every host that resolves these options.
 * @internal
 */
export const DEPRECATED_INJECT_NODE_COMPAT_WARNING =
  '`inject: {nodeCompat: true}` is deprecated: `nodeCompat` configures the package exports, not the injected import. Use `{inject: true, exports: {nodeCompat: true}}` instead.'
