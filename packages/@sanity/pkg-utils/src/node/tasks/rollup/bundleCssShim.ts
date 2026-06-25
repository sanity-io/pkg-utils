import type {Plugin} from 'rollup'

/**
 * Emits a no-op JavaScript shim (`export default ""`) alongside the extracted CSS. The conditional
 * `./<css>` export points its `node`/`default` conditions at this file so that the self-referential
 * `import "<pkg>/<css>"` resolves to a harmless module in runtimes that cannot import `.css` files,
 * instead of throwing `Error: Unknown file extension ".css"`.
 *
 * @param options.fileName - The shim file name, e.g. `bundle.css.js`.
 * @internal
 */
export function bundleCssShim(options: {fileName: string}): Plugin {
  const cssName = options.fileName.replace(/\.js$/, '')

  return {
    name: 'pkg-utils:bundle-css-shim',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: options.fileName,
        source: `// No-op shim for \`${cssName}\` in runtimes that cannot import \`.css\` files directly.\nexport default ""\n`,
      })
    },
  }
}
