import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {evaluateVanillaModule} from '../src/evaluateVanillaModule.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'
import {processVanillaProgram} from '../src/processVanillaProgram.ts'
import {transformCss} from '../src/transformCss/transformCss.ts'
import type {IdentifierOption} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '..')

const kitchenSink = ['entry', 'styles', 'theme'].map((name) =>
  path.join(__dirname, `fixtures/kitchen-sink/${name}.css.ts`),
)
const basic = ['entry', 'theme'].map((name) =>
  path.join(__dirname, `fixtures/basic/${name}.css.ts`),
)

/** The serialized exports of a module, without its virtual CSS import lines. */
const exportsOf = (source: string) =>
  source
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')

/**
 * Splits rendered CSS back into its top-level rules (the strings `transformCss` returns before
 * they're joined by newlines) so rule sets can be compared regardless of order.
 */
const topLevelRules = (css: string) => {
  const rules: string[] = []
  let depth = 0
  let current: string[] = []
  for (const line of css.split('\n')) {
    current.push(line)
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length
    if (depth === 0) {
      rules.push(current.join('\n'))
      current = []
    }
  }
  expect(current).toEqual([])
  return rules.filter(Boolean).toSorted()
}

async function perModuleRules(filePath: string, identOption: IdentifierOption) {
  const {source} = await compile({filePath, cwd: packageRoot, identOption})
  const {cssByFileScope, localClassNames, composedClassLists} = evaluateVanillaModule({
    source,
    filePath,
    identOption,
  })
  const rules: string[] = []
  for (const cssObjs of cssByFileScope.values()) {
    rules.push(
      ...transformCss({
        localClassNames: [...localClassNames],
        composedClassLists,
        cssObjs,
        onCompositionUsed: () => {},
      }),
    )
  }
  return rules
}

describe('processVanillaProgram', () => {
  describe.each<IdentifierOption>(['short', 'debug'])('%s identifiers', (identOption) => {
    test('serializes every module to the same exports as per-module processing', async () => {
      const program = await processVanillaProgram({
        filePaths: [...kitchenSink, ...basic],
        cwd: packageRoot,
        identOption,
      })

      expect([...program.modules.keys()]).toEqual([...kitchenSink, ...basic])

      for (const filePath of [...kitchenSink, ...basic]) {
        const {source} = await compile({filePath, cwd: packageRoot, identOption})
        const perModule = await processVanillaFile({source, filePath, identOption})
        expect(exportsOf(program.modules.get(filePath) ?? ''), filePath).toBe(exportsOf(perModule))
      }
    })

    test('renders the same rule set as per-module processing, in dependency-then-discovery order', async () => {
      const program = await processVanillaProgram({
        filePaths: kitchenSink,
        cwd: packageRoot,
        identOption,
      })

      // The entry imports styles, which imports theme: dependencies render first
      expect(program.fileScopes.map((scope) => path.basename(scope.filePath))).toEqual([
        'theme.css.ts',
        'styles.css.ts',
        'entry.css.ts',
      ])

      // Same rules as rendering each module on its own (the whole program is one Stylesheet, so
      // at-rule declarations are hoisted once and conditional blocks follow all unconditional
      // rules — an ordering difference only)
      const expectedRules = new Set<string>()
      for (const filePath of kitchenSink) {
        for (const rule of await perModuleRules(filePath, identOption)) expectedRules.add(rule)
      }
      expect(topLevelRules(program.css)).toEqual([...expectedRules].toSorted())
    })
  })

  test('prepends the given CSS imports to every module and reports the watched files', async () => {
    const program = await processVanillaProgram({
      filePaths: basic,
      cwd: packageRoot,
      identOption: 'short',
      cssImports: ["import 'virtual:vanilla-extract.css';"],
    })

    for (const source of program.modules.values()) {
      expect(source.startsWith("import 'virtual:vanilla-extract.css';\n")).toBe(true)
    }
    expect(program.watchFiles).toEqual(
      expect.arrayContaining([...basic, path.join(__dirname, 'fixtures/basic/util.ts')]),
    )
    expect(program.watchFiles.some((file) => file.startsWith('\0'))).toBe(false)
  })

  test('keeps compositions referenced by selectors in other modules', async () => {
    const program = await processVanillaProgram({
      filePaths: kitchenSink,
      cwd: packageRoot,
      identOption: 'debug',
    })
    const styles = program.modules.get(kitchenSink[1] ?? '') ?? ''

    // `pureComposition` is referenced by `referencesComposition`'s selector: its identifier stays
    expect(styles).toMatch(
      /export var pureComposition = 'styles_pureComposition__\w+ styles_base__\w+ styles_card__\w+';/,
    )
    // `unusedPureComposition` is not referenced anywhere: its identifier is stripped
    expect(styles).toMatch(
      /export var unusedPureComposition = 'styles_base__\w+ styles_reversedMedia__\w+';/,
    )
  })

  test('evaluates shared dependencies once', async () => {
    const program = await processVanillaProgram({
      filePaths: kitchenSink,
      cwd: packageRoot,
      identOption: 'short',
    })

    // theme.css.ts is imported by both styles.css.ts and entry.css.ts, yet appears once
    const themeScopes = program.fileScopes.filter((scope) =>
      scope.filePath.endsWith('theme.css.ts'),
    )
    expect(themeScopes).toHaveLength(1)
    expect(program.css.match(/@keyframes spin/g)).toHaveLength(1)
  })
})
