import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {getSourceFromVirtualCssFile} from '../src/getSourceFromVirtualCssFile.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '..')
const entryPath = path.join(__dirname, 'fixtures/basic/entry.css.ts')

describe('processVanillaFile', () => {
  test('evaluates compiled output into virtual CSS imports and serialized exports', async () => {
    const {source} = await compile({
      filePath: entryPath,
      cwd: packageRoot,
      identOption: 'short',
    })

    const output = await processVanillaFile({source, filePath: entryPath, identOption: 'short'})

    // One virtual CSS import per .css.ts module in the graph, dependencies first
    const cssImports = output.split('\n').filter((line) => line.includes('.vanilla.css?source='))
    expect(cssImports).toHaveLength(2)
    expect(cssImports[0]).toContain('theme.css.ts.vanilla.css')
    expect(cssImports[1]).toContain('entry.css.ts.vanilla.css')

    // The exports are serialized as plain ES exports
    expect(output).toMatch(/export var box = ['"][^'"]+['"];/)

    // The virtual import round-trips back into the extracted CSS
    const importSpecifier = /import '([^']+)';/.exec(cssImports[1] ?? '')?.[1]
    expect(importSpecifier).toBeDefined()
    const {fileName, source: css} = await getSourceFromVirtualCssFile(importSpecifier ?? '')
    expect(fileName).toContain('entry.css.ts.vanilla.css')
    expect(css).toContain('rgb(1, 2, 3)')
    expect(css).toContain('padding: 8px')
  })

  test('carries debug identifiers through to the generated class names', async () => {
    const {source} = await compile({
      filePath: entryPath,
      cwd: packageRoot,
      identOption: 'debug',
    })

    const output = await processVanillaFile({source, filePath: entryPath, identOption: 'debug'})

    // The entry's own export carries the debug class name directly
    expect(output).toMatch(/entry_box__/)

    // The theme module's exports aren't re-exported from the entry, so its debug class name
    // only shows up inside its virtual CSS payload
    const themeImport = /import '([^']+theme\.css\.ts\.vanilla\.css[^']+)';/.exec(output)?.[1]
    expect(themeImport).toBeDefined()
    const {source: themeCss} = await getSourceFromVirtualCssFile(themeImport ?? '')
    expect(themeCss).toMatch(/\.theme_themeClass__/)
  })

  test('supports custom virtual CSS path serialization', async () => {
    const {source} = await compile({
      filePath: entryPath,
      cwd: packageRoot,
      identOption: 'short',
    })

    const seen: string[] = []
    const output = await processVanillaFile({
      source,
      filePath: entryPath,
      identOption: 'short',
      serializeVirtualCssPath: ({fileName}) => {
        seen.push(fileName)
        return `import '${fileName}?custom';`
      },
    })

    expect(seen).toHaveLength(2)
    expect(output).toContain(`?custom';`)
    expect(output).not.toContain('?source=')
  })

  test('evaluates hand-written CommonJS sources through the vm sandbox', async () => {
    const source = `
const { style } = require('@vanilla-extract/css');
const { setFileScope, endFileScope } = require('@vanilla-extract/css/fileScope');
setFileScope('test/unit.css.js', 'test-pkg');
exports.block = style({ color: 'rgb(9, 9, 9)' });
endFileScope();
`
    // The path doesn't need to exist: it only anchors require() resolution for the sandbox
    const output = await processVanillaFile({
      source,
      filePath: path.join(packageRoot, 'test/unit.css.js'),
      identOption: 'short',
    })

    expect(output).toMatch(/export var block = ['"][^'"]+['"];/)
    expect(output).toContain(`test/unit.css.js.vanilla.css?source=`)
  })
})
