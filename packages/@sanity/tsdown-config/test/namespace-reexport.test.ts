import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {afterAll, describe, expect, test} from 'vitest'
import {checkTsdoc} from '../src/tsdoc/index.ts'
import {collectSynthesizedNamespaceWrappers} from '../src/tsdoc/synthesizedNamespaces.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/namespace-reexport-library')

// The declaration bundler synthesizes `declare namespace <module>_d_exports {…}` wrappers for
// namespace re-exports (`export * as ns from './module'`, or `import * as ns` + `export {ns}`)
// and loses the doc comment of the re-export statement, so the wrapper can never carry a
// release tag. `ae-missing-release-tag` must skip the wrappers — and only the wrappers.
// https://github.com/sanity-io/pkg-utils/issues/3281
describe('namespace-reexport-library', () => {
  test('the declaration bundler still synthesizes untaggable namespace wrappers', async () => {
    // The fixture (and with it the skip behavior) only regression-tests the issue for as long
    // as the bundled declarations keep this shape — if this fails, re-verify how namespace
    // re-exports are emitted before adjusting the assertions
    const distIndexDts = await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf-8')

    // The wrapper of `export * as inner` is shared with the `extra` entry, so it lives in a
    // chunk both entries import; the wrapper of the `import * as other` + `export {other}`
    // pattern is declared in the entry itself. Neither carries the `/** @alpha */` comment of
    // the re-export statement.
    expect(distIndexDts).toMatch(/import \{ \w+ as inner_d_exports \} from "\.\/inner-[\w-]+\.js"/)
    expect(distIndexDts).toContain('declare namespace other_d_exports')
    expect(distIndexDts).not.toMatch(/@alpha[\s*/]*declare namespace/)
    expect(distIndexDts).toContain('inner_d_exports as inner')
    expect(distIndexDts).toContain('other_d_exports as other')
    // The user symbol colliding with the wrapper name is deconflicted, not merged
    expect(distIndexDts).toMatch(/declare const inner_d_exports\$1: string/)
  })

  test('collects the synthesized wrappers of entry- and chunk-hosted namespaces', async () => {
    // `other_d_exports` is declared in the entry itself, `inner_d_exports` in the shared
    // chunk; the deconflicted user symbol (`inner_d_exports$1`, a const) is not a namespace
    // and must stay checked
    expect(collectSynthesizedNamespaceWrappers(path.join(fixtureDir, 'dist/index.d.ts'))).toEqual(
      new Set(['inner_d_exports', 'other_d_exports']),
    )
    expect(collectSynthesizedNamespaceWrappers(path.join(fixtureDir, 'dist/index.d.cts'))).toEqual(
      new Set(['inner_d_exports', 'other_d_exports']),
    )
    expect(collectSynthesizedNamespaceWrappers(path.join(fixtureDir, 'dist/extra.d.ts'))).toEqual(
      new Set(['inner_d_exports']),
    )
    expect(collectSynthesizedNamespaceWrappers(path.join(fixtureDir, 'dist/extra.d.cts'))).toEqual(
      new Set(['inner_d_exports']),
    )
  })

  test('checkTsdoc passes: the wrappers are skipped', async () => {
    const result = await checkTsdoc({
      cwd: fixtureDir,
      entryDtsFiles: [
        path.join(fixtureDir, 'dist/index.d.ts'),
        path.join(fixtureDir, 'dist/index.d.cts'),
        path.join(fixtureDir, 'dist/extra.d.ts'),
        path.join(fixtureDir, 'dist/extra.d.cts'),
      ],
      tsconfig: 'tsconfig.dist.json',
      rules: {'ae-missing-release-tag': 'error'},
    })

    expect(
      result.messages.filter((message) => message.messageId === 'ae-missing-release-tag'),
    ).toEqual([])
    expect(result.errorCount).toBe(0)
  })
})

function runCheck(dir: string) {
  return checkTsdoc({
    cwd: dir,
    entryDtsFiles: [path.join(dir, 'index.d.ts')],
    rules: {'ae-missing-release-tag': 'error'},
  })
}

describe('checkTsdoc synthesized wrapper skip', () => {
  const tempDirs: string[] = []
  afterAll(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, {recursive: true, force: true})))
  })

  /** A minimal project around a handwritten entry `.d.ts`, shaped like the bundler's output. */
  async function spawnDtsProject(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tsdown-config-tsdoc-'))
    tempDirs.push(dir)
    await writeFile(
      path.join(dir, 'package.json'),
      JSON.stringify({name: 'temp-tsdoc-check', version: '1.0.0', type: 'module'}),
    )
    await writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify({compilerOptions: {}}))
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(path.join(dir, name), contents)
    }
    return dir
  }

  test('skips the synthesized wrapper of a namespace re-export', async () => {
    const dir = await spawnDtsProject({
      'index.d.ts': [
        'declare namespace inner_d_exports {',
        '  export { hello };',
        '}',
        '/** @alpha */',
        'declare function hello(): string;',
        'export { inner_d_exports as inner };',
        '',
      ].join('\n'),
    })

    await expect(runCheck(dir)).resolves.toMatchObject({errorCount: 0})
  })

  test('the skip only ever silences the wrapper itself', async () => {
    // Symbols that are only reachable through the namespace are not consumable entities of
    // api-extractor's missing-release-tag check (with or without the skip), so an untagged
    // member does not fail the check — but a directly exported untagged symbol next to the
    // wrapper still does
    const dir = await spawnDtsProject({
      'index.d.ts': [
        'declare namespace inner_d_exports {',
        '  export { hello };',
        '}',
        'declare function hello(): string;',
        'declare const untagged: boolean;',
        'export { inner_d_exports as inner, untagged };',
        '',
      ].join('\n'),
    })

    await expect(runCheck(dir)).rejects.toThrow(/TSDoc\/release-tag check failed with 1 error/)
  })

  test('still flags an untagged namespace the entry exports unaliased', async () => {
    // An unaliased export is a name the author chose (and can tag) — only the alias-only
    // re-export shape of the synthesized wrappers is skipped
    const dir = await spawnDtsProject({
      'index.d.ts': [
        'declare namespace foo_exports {',
        '  export { hello };',
        '}',
        '/** @alpha */',
        'declare function hello(): string;',
        'export { foo_exports };',
        '',
      ].join('\n'),
    })

    await expect(runCheck(dir)).rejects.toThrow(/TSDoc\/release-tag check failed with 1 error/)
  })

  test('still flags a user namespace with a wrapper-like name exported under an alias', async () => {
    const dir = await spawnDtsProject({
      'index.d.ts': [
        'declare namespace config_exports {',
        '  const userValue: string;',
        '}',
        'export { config_exports as config };',
        '',
      ].join('\n'),
    })

    await expect(runCheck(dir)).rejects.toThrow(/TSDoc\/release-tag check failed with 1 error/)
  })

  test('still flags a deconflicted user namespace that collides with a wrapper', async () => {
    // Rolldown keeps the wrapper name and adds `$1` to the user namespace after a collision.
    const dir = await spawnDtsProject({
      'index.d.ts': [
        'import { t as inner_d_exports } from "./chunk.js";',
        'declare namespace inner_d_exports$1 {',
        '  const userValue: string;',
        '}',
        'export { inner_d_exports as inner, inner_d_exports$1 as inner_d_exports };',
        '',
      ].join('\n'),
      'chunk.d.ts': [
        'declare namespace inner_d_exports {',
        '  export { hello };',
        '}',
        '/** @alpha */',
        'declare function hello(): string;',
        'export { inner_d_exports as t };',
        '',
      ].join('\n'),
    })

    await expect(runCheck(dir)).rejects.toThrow(/TSDoc\/release-tag check failed with 1 error/)
  })

  test('still flags untagged non-namespace symbols named like a wrapper', async () => {
    const dir = await spawnDtsProject({
      'index.d.ts': [
        'declare const csv_exports: string[];',
        'export { csv_exports as csv };',
        '',
      ].join('\n'),
    })

    await expect(runCheck(dir)).rejects.toThrow(/TSDoc\/release-tag check failed with 1 error/)
  })
})

describe('collectSynthesizedNamespaceWrappers', () => {
  const tempDirs: string[] = []
  afterAll(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, {recursive: true, force: true})))
  })

  async function spawnDts(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tsdown-config-wrappers-'))
    tempDirs.push(dir)
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(path.join(dir, name), contents)
    }
    return dir
  }

  test('accepts rolldown deconflict suffixes on the wrapper name', async () => {
    const dir = await spawnDts({
      'index.d.ts': [
        'declare namespace inner_d_exports$1 {',
        '  export { hello };',
        '}',
        'declare function hello(): string;',
        'export { inner_d_exports$1 as inner };',
        '',
      ].join('\n'),
    })

    expect(collectSynthesizedNamespaceWrappers(path.join(dir, 'index.d.ts'))).toEqual(
      new Set(['inner_d_exports$1']),
    )
  })

  test('follows relative chunk imports across declaration extensions', async () => {
    const dir = await spawnDts({
      'index.d.mts': [
        'import { t as inner_d_exports } from "./chunk-abc123.mjs";',
        'export { inner_d_exports as inner };',
        '',
      ].join('\n'),
      'chunk-abc123.d.mts': [
        'declare namespace inner_d_exports {',
        '  export { hello };',
        '}',
        'declare function hello(): string;',
        'export { inner_d_exports as t };',
        '',
      ].join('\n'),
    })

    expect(collectSynthesizedNamespaceWrappers(path.join(dir, 'index.d.mts'))).toEqual(
      new Set(['inner_d_exports']),
    )
  })

  test('ignores namespaces without the interop naming, and non-namespace declarations', async () => {
    const dir = await spawnDts({
      'index.d.ts': [
        'declare namespace helpers {',
        '  export { hello };',
        '}',
        'declare function hello(): string;',
        'declare const csv_exports: string[];',
        'export { helpers as utils, csv_exports as csv };',
        '',
      ].join('\n'),
    })

    expect(collectSynthesizedNamespaceWrappers(path.join(dir, 'index.d.ts'))).toEqual(new Set())
  })

  test('ignores a wrapper-named namespace that declares members of its own', async () => {
    // Only the bundler's `export { … };`-specifier-only body shape is a wrapper; a namespace
    // with its own members is user-authored, and those members are what the author tags
    const dir = await spawnDts({
      'index.d.ts': [
        'declare namespace config_exports {',
        '  const userValue: string;',
        '}',
        'declare namespace mixed_exports {',
        '  export { hello };',
        '  const extra: number;',
        '}',
        'declare function hello(): string;',
        'export { config_exports as config, mixed_exports as mixed };',
        '',
      ].join('\n'),
    })

    expect(collectSynthesizedNamespaceWrappers(path.join(dir, 'index.d.ts'))).toEqual(new Set())
  })

  test('ignores wrapper-named declarations the entry exports directly', async () => {
    const dir = await spawnDts({
      'index.d.ts': [
        'declare namespace foo_exports {',
        '  export { hello };',
        '}',
        'export declare namespace bar_exports {',
        '  export { hello };',
        '}',
        'declare function hello(): string;',
        'export { foo_exports };',
        '',
      ].join('\n'),
    })

    expect(collectSynthesizedNamespaceWrappers(path.join(dir, 'index.d.ts'))).toEqual(new Set())
  })

  test('returns an empty set for a missing entry file', async () => {
    const dir = await spawnDts({})

    expect(collectSynthesizedNamespaceWrappers(path.join(dir, 'missing.d.ts'))).toEqual(new Set())
  })
})
