import type {Plugin} from 'rolldown'

/**
 * Emits a no-op JavaScript shim (`export default ""`) alongside the extracted CSS. A conditional
 * `./<css>` export can point its `node`/`default` conditions at this file so that a
 * self-referential `import "<pkg>/<css>"` resolves to a harmless module in runtimes that cannot
 * import `.css` files, instead of throwing `Error: Unknown file extension ".css"`.
 *
 * A matching `.d.ts` declaration is emitted next to the shim as well. Both the `browser`/`style`
 * (`<css>`) and the `node`/`default` (`<css>.js`) conditions of the `./<css>` export resolve their
 * types to the same `<css>.d.ts` file, so type-aware tooling (e.g. dts export checkers that load a
 * `.d.ts` for every export target) does not crash on a missing declaration file.
 *
 * @param options.fileName - The shim file name, e.g. `bundle.css.js`.
 * @internal
 */
export function cssShim(options: {fileName: string}): Plugin {
  const cssName = options.fileName.replace(/\.js$/, '')

  return {
    name: 'vanilla-extract:css-shim',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: options.fileName,
        source: `// No-op shim for \`${cssName}\` in runtimes that cannot import \`.css\` files directly.\nexport default ""\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: `${cssName}.d.ts`,
        source: `// Type declarations for \`${cssName}\` and its no-op JS shim.\ndeclare const _default: string\nexport default _default\n`,
      })
    },
  }
}
