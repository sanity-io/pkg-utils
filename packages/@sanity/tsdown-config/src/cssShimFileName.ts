/**
 * The no-op JS shim file name for a CSS file under `exports.nodeCompat`.
 *
 * `bundle.css` → `bundle-css.js` — deliberately not `${cssFileName}.js` (`bundle.css.js`),
 * which vanilla-extract's `cssFileFilter` (`/\.css\.(js|cjs|mjs|jsx|ts|tsx)$/`) would treat as
 * a stylesheet module. When a consumer later resolves `./bundle.css` to the shim (e.g. via
 * Vitest/Vite's `ModuleRunner` under the `node`/`default` export conditions), a `.css.js`
 * filename would be compiled as if it were `.css.ts` output and throw.
 *
 * @public
 */
export function cssShimFileName(cssFileName: string): string {
  return `${cssFileName.replace(/\.css$/, '-css')}.js`
}

/**
 * The `.d.ts` companion for {@link cssShimFileName}. `bundle.css` → `bundle-css.d.ts`.
 * The conditional `./<css>` export's `types` condition points at this file.
 *
 * @public
 */
export function cssShimDtsFileName(cssFileName: string): string {
  return `${cssFileName.replace(/\.css$/, '-css')}.d.ts`
}

/**
 * The contents of the no-op JS shim named by {@link cssShimFileName}.
 *
 * Intentionally free of syntax so it parses as both CommonJS and an ES module: the package
 * `type` decides how Node interprets a `.js` file, and the same shim backs the `node`/`default`
 * conditions for `require()` and `import` alike.
 *
 * @public
 */
export function cssShimSource(cssFileName: string): string {
  return `// No-op shim for \`${cssFileName}\`, resolved by the \`node\`/\`default\` conditions of the
// conditional CSS export so the self-referential import is harmless in runtimes that cannot
// load \`.css\` files. Intentionally has no JS syntax: it parses as both CommonJS and an ES
// module, regardless of the package \`type\`.
`
}

/**
 * The contents of the declaration file named by {@link cssShimDtsFileName}. The conditional
 * export's `types` condition points at it, so a separate `<css>.d.ts` is unnecessary.
 *
 * @public
 */
export function cssShimDtsSource(cssFileName: string): string {
  return `// Type declarations for \`${cssFileName}\` and its no-op JS shim.
export {}
`
}
