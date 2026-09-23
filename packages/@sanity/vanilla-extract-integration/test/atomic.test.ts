import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'
import {getSourceFromVirtualCssFile} from '../src/getSourceFromVirtualCssFile.ts'
import {normalizePath} from '../src/normalizePath.ts'
import {processVanillaFile} from '../src/processVanillaFile.ts'
import {processVanillaProgram} from '../src/processVanillaProgram.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '..')
const entryPath = path.join(__dirname, 'fixtures/atomic/entry.css.ts')
const basePath = path.join(__dirname, 'fixtures/atomic/base.css.ts')

/** `export var name = '...';` → the class list, for every string export of a serialized module. */
function classLists(source: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of source.matchAll(/^export var (\w+) = '([^']*)';$/gm)) {
    result[match[1]!] = match[2]!
  }
  return result
}

/** `.selector {\n  decl;\n}` blocks of rendered CSS, top level only, in order. */
function topLevelRules(css: string): string[] {
  const rules: string[] = []
  let depth = 0
  let current: string[] = []
  for (const line of css.split('\n')) {
    if (!line && current.length === 0) continue
    current.push(line)
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length
    if (depth === 0) {
      rules.push(current.join('\n'))
      current = []
    }
  }
  return rules
}

/** Top-level rules with the atomic scope hashes masked, so scopes can be compared. */
const bodies = (css: string) =>
  topLevelRules(css).map((rule) => rule.replaceAll(/__[a-f0-9]{8}/g, '__HASH'))

async function renderPerModule(identOption: 'short' | 'debug') {
  const {source} = await compile({filePath: entryPath, cwd: packageRoot, identOption})
  const output = await processVanillaFile({
    source,
    filePath: entryPath,
    identOption,
    atomic: true,
  })
  const cssByFile = new Map<string, string>()
  for (const line of output.split('\n')) {
    const specifier = /^import '([^']+)';$/.exec(line)?.[1]
    if (!specifier) continue
    const {fileName, source: css} = await getSourceFromVirtualCssFile(specifier)
    cssByFile.set(path.basename(fileName), css)
  }
  return {output, classLists: classLists(output), cssByFile}
}

describe('atomic pass, per-module rendering', () => {
  test('matches the snapshot', async () => {
    const {output, cssByFile} = await renderPerModule('debug')
    expect(output).toMatchSnapshot('module')
    expect(cssByFile.get('base.css.ts.vanilla.css')).toMatchSnapshot('base css')
    expect(cssByFile.get('entry.css.ts.vanilla.css')).toMatchSnapshot('entry css')
  })

  test('shares identical declarations until an overlapping declaration intervenes', async () => {
    const {classLists: lists} = await renderPerModule('debug')
    const atoms = (name: string) => lists[name]!.split(' ').slice(1)

    // a and b share `padding: 0`; their `display` values differ
    const [aDisplay, aPadding] = atoms('a')
    const [bDisplay, bPadding] = atoms('b')
    expect(aPadding).toBe(bPadding)
    expect(aDisplay).not.toBe(bDisplay)
    // c's `display: block` cannot share a's: b's `display: inline` renders between them
    expect(atoms('c')).toHaveLength(1)
    expect(atoms('c')[0]).not.toBe(aDisplay)
    expect(atoms('c')[0]).toMatch(/^display_block__/)

    // The longhand keeps the authored order within a style and is a barrier for the shorthand
    const [stlPadding, stlBottom] = atoms('shorthandThenLonghand')
    expect(stlPadding).toBe(aPadding)
    expect(stlBottom).toMatch(/^paddingBottom_4px__/)
    expect(atoms('paddingAgain')[0]).not.toBe(aPadding)
    const [ltsBottom, ltsPadding] = atoms('longhandThenShorthand')
    expect(ltsBottom).toMatch(/^paddingBottom_4px__/)
    expect(ltsBottom).not.toBe(stlBottom)
    expect(ltsPadding).toMatch(/^padding_0__/)
    expect(ltsPadding).not.toBe(atoms('paddingAgain')[0])
  })

  test('renders every atomic class as a rule of its own, keeping selector shapes', async () => {
    const {classLists: lists, cssByFile} = await renderPerModule('debug')
    const css = cssByFile.get('entry.css.ts.vanilla.css') ?? ''
    const [identity, ...atoms] = lists['interactive']!.split(' ')
    expect(identity).toMatch(/^entry_interactive__/)
    expect(atoms).toHaveLength(5)

    const [color, hoverColor, beforeContent, doubled, themed] = atoms
    expect(css).toContain(`.${color} {\n  color: rgb(1, 2, 3);\n}`)
    expect(css).toContain(`.${hoverColor}:hover {\n  color: rgb(4, 5, 6);\n}`)
    expect(css).toContain(`.${beforeContent}::before {\n  content: "";\n}`)
    // `&&` keeps its doubled specificity...
    expect(css).toContain(`.${doubled}.${doubled} {\n  opacity: 0.9;\n}`)
    // ...`${theme} &` keeps the ancestor...
    expect(css).toMatch(
      new RegExp(`\\.base_theme__\\w+ \\.${themed} \\{\\n {2}color: rgb\\(7, 8, 9\\);\\n\\}`),
    )
    // ...and `& + &` stays on the identity class, since sharing it would match siblings of
    // every style with the same declaration
    expect(css).toContain(`.${identity} + .${identity} {\n  margin-top: 8px;\n}`)
  })

  test('keeps media query precedence and shares within a query', async () => {
    const {classLists: lists, cssByFile} = await renderPerModule('debug')
    const css = cssByFile.get('entry.css.ts.vanilla.css') ?? ''
    expect(lists['responsiveToo']!.split(' ').slice(1)).toEqual(
      lists['responsive']!.split(' ').slice(1),
    )
    const [narrow, wide] = lists['responsive']!.split(' ').slice(1)
    const narrowRule = css.indexOf(`@media screen and (min-width: 640px) {\n  .${narrow}`)
    const wideRule = css.indexOf(`@media screen and (min-width: 1024px) {\n  .${wide}`)
    expect(narrowRule).toBeGreaterThan(-1)
    expect(wideRule).toBeGreaterThan(narrowRule)
  })

  test('treats other layers and other importance as unrelated to a run', async () => {
    const {classLists: lists} = await renderPerModule('debug')
    const atoms = (name: string) => lists[name]!.split(' ').slice(1)
    // `@layer components { padding: 4px }` does not break the unlayered `padding: 0` run
    expect(atoms('paddingAfterLayer')[0]).toBe(atoms('longhandThenShorthand')[1])
    // ...and `margin: 4px` (normal) does not break the `!important` run
    expect(atoms('importantAgain')[0]).toBe(atoms('important')[0])
    expect(atoms('marginNormal')[0]).not.toBe(atoms('important')[0])
  })

  test('expands compositions, variants, recipes and sprinkles with the identity class first', async () => {
    const {output, classLists: lists} = await renderPerModule('debug')
    const [aIdentity, ...aAtoms] = lists['a']!.split(' ')

    // A composition with its own rules: its identity, its atoms, then each member expanded
    const composed = lists['composed']!.split(' ')
    expect(composed[0]).toMatch(/^entry_composed__/)
    expect(composed[1]).toMatch(/^color_rgb_1_2_3__/)
    expect(composed.slice(2)).toEqual([aIdentity, ...aAtoms])
    // A pure composition nobody references drops its own identity (like upstream) and lists
    // each member once even when they share atoms
    const pure = lists['pureComposition']!.split(' ')
    expect(pure[0]).toBe(aIdentity)
    expect(new Set(pure).size).toBe(pure.length)
    expect(pure).toContain(lists['b']!.split(' ')[0])

    // Recipes serialize their class lists inside the runtime config
    expect(output).toMatch(
      /\(\{defaultClassName:'entry_button__\w+ display_inline_flex__\w+ padding_0__\w+'/,
    )
    expect(output).toMatch(/small:'entry_button_size_small__\w+ padding_4px__\w+'/)
    // Sprinkles are single-declaration styles already: identity plus one atom each
    expect(output).toMatch(/defaultClass:'entry_\w+__\w+ display_none__\w+'/)
    expect(output).toMatch(/defaultClass:'entry_\w+__\w+ padding_0__\w+'/)
  })

  test('short identifiers produce compact atomic class names', async () => {
    const {classLists: lists, cssByFile} = await renderPerModule('short')
    for (const atom of lists['a']!.split(' ').slice(1)) {
      expect(atom).toMatch(/^_a[a-f0-9]{8}$/)
      expect(cssByFile.get('entry.css.ts.vanilla.css')).toContain(`.${atom} {`)
    }
  })
})

describe('atomic pass, whole-program rendering', () => {
  test('shares declarations across modules and matches the snapshot', async () => {
    const program = await processVanillaProgram({
      filePaths: [entryPath, basePath],
      cwd: packageRoot,
      identOption: 'debug',
      atomic: true,
    })
    expect(program.css).toMatchSnapshot('program css')
    const entrySource = program.modules.get(normalizePath(entryPath))
    const baseSource = program.modules.get(normalizePath(basePath))
    expect(entrySource).toMatchSnapshot('entry module')
    expect(baseSource).toMatchSnapshot('base module')

    const entry = classLists(entrySource ?? '')
    const base = classLists(baseSource ?? '')
    const baseCardAtoms = base['baseCard']!.split(' ').slice(1)
    const cardAtoms = entry['card']!.split(' ').slice(1)
    // base.css.ts renders first (entry imports it). `usesVars`'s `gap` shares baseCard's:
    // nothing overlapping renders between them...
    expect(entry['usesVars']!.split(' ').slice(1)).toEqual([baseCardAtoms[2]])
    // ...while `card`'s `display: flex` and `padding: 0` cannot share baseCard's, because
    // entry's `a`/`b`/`c` declare other display values and `paddingBottom` in between
    expect(cardAtoms[0]).not.toBe(baseCardAtoms[0])
    expect(cardAtoms[1]).not.toBe(baseCardAtoms[1])
    expect(program.atomicReport?.sharedDeclarations).toBeGreaterThan(0)
  })

  test('renders the same rules for every module as per-module rendering, minus the shares', async () => {
    const perModule = await renderPerModule('debug')
    const program = await processVanillaProgram({
      filePaths: [entryPath, basePath],
      cwd: packageRoot,
      identOption: 'debug',
      atomic: true,
    })
    // Every top-level rule of the program stylesheet is a rule of some per-module stylesheet
    // (classes differ by scope hash, so compare declaration bodies)
    const perModuleBodies = new Set([
      ...bodies(perModule.cssByFile.get('base.css.ts.vanilla.css') ?? ''),
      ...bodies(perModule.cssByFile.get('entry.css.ts.vanilla.css') ?? ''),
    ])
    for (const rule of bodies(program.css)) {
      expect(perModuleBodies.has(rule), rule).toBe(true)
    }
  })
})
