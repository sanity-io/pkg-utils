import type {Plugin} from 'rollup'

function createBundleCssDeclaration(cssName: string): string {
  return `/**
 * Side-effect CSS bundle extracted by vanilla-extract compat mode.
 */
export {}
`
}

function createBundleCssShimDeclaration(cssName: string): string {
  return `/**
 * No-op shim for \`${cssName}\` in runtimes that cannot import \`.css\` files directly.
 */
declare const css: ''
export default css
`
}

/**
 * Emits a no-op JavaScript shim (`export default ""`) alongside the extracted CSS. The conditional
 * `./<css>` export points its `node`/`default` conditions at this file so that the self-referential
 * `import "<pkg>/<css>"` resolves to a harmless module in runtimes that cannot import `.css` files,
 * instead of throwing `Error: Unknown file extension ".css"`.
 *
 * Also emits `.d.ts` companions for both export targets:
 * - `<css>.d.ts` for the extracted CSS file (`browser` / `style` conditions)
 * - `<css>.js.d.ts` for the JS shim (`node` / `default` conditions)
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
      this.emitFile({
        type: 'asset',
        fileName: `${cssName}.d.ts`,
        source: createBundleCssDeclaration(cssName),
      })
      this.emitFile({
        type: 'asset',
        fileName: `${options.fileName}.d.ts`,
        source: createBundleCssShimDeclaration(cssName),
      })
    },
  }
}
