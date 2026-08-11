import {mkdir, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {build, mergeConfig, type Rolldown, type UserConfig} from 'tsdown'
import {afterAll, describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'
import {namespaceReleaseTagPlugin} from '../src/namespaceReleaseTagPlugin.ts'

const fixtureDirs: string[] = []

afterAll(async () => {
  await Promise.all(fixtureDirs.map((fixtureDir) => rm(fixtureDir, {force: true, recursive: true})))
})

describe('namespace re-export release tags', () => {
  test(
    'preserves an explicit tag on the generated ESM and CJS namespaces',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        index: `/** @alpha */\nexport * as inner from './inner'\n`,
        inner: `/** @alpha */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await runBuild(fixtureDir, ['esm', 'cjs'])

      for (const declarationFile of ['index.d.ts', 'index.d.cts']) {
        const declaration = await readFile(path.join(fixtureDir, 'dist', declarationFile), 'utf8')
        expect(declaration).toContain('/** @alpha */ declare namespace inner_d_exports')
        expect(declaration).toContain('/** @alpha */\ndeclare function hello(): string')

        const sourceMap: {mappings: string; sources: string[]} = JSON.parse(
          await readFile(path.join(fixtureDir, 'dist', `${declarationFile}.map`), 'utf8'),
        )
        expect(sourceMap.sources).toContain('../src/inner.ts')
        expect(sourceMap.mappings).not.toBe('')
      }
    },
  )

  test('preserves a tag on imported namespace re-exports', {timeout: 120_000}, async () => {
    const cases = [
      {
        tag: 'beta',
        index: `/** @beta */\nimport * as inner from './inner'\nexport {inner}\n`,
      },
      {
        tag: 'public',
        index: `import * as inner from './inner'\n/** @public */\nexport {inner}\n`,
      },
    ] as const

    for (const {index, tag} of cases) {
      const fixtureDir = await createFixture({
        index,
        inner: `/** @${tag} */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })
      await runBuild(fixtureDir)
      expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toContain(
        `/** @${tag} */ declare namespace inner_d_exports`,
      )
    }
  })

  test(
    'does not invent a tag when namespace import and export tags conflict',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        index: `/** @alpha */\nimport * as inner from './inner'\n/** @beta */\nexport {inner}\n`,
        inner: `/** @alpha */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await expect(runBuild(fixtureDir)).rejects.toThrow(
        'TSDoc/release-tag check failed with 1 error',
      )
      expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toMatch(
        /^declare namespace inner_d_exports/,
      )
    },
  )

  test('does not invent a tag for untagged namespace re-exports', {timeout: 120_000}, async () => {
    for (const index of [
      `export * as inner from './inner'\n`,
      `import * as inner from './inner'\nexport {inner}\n`,
    ]) {
      const fixtureDir = await createFixture({
        index,
        inner: `/** @alpha */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await expect(runBuild(fixtureDir)).rejects.toThrow(
        'TSDoc/release-tag check failed with 1 error',
      )
      expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toMatch(
        /^declare namespace inner_d_exports/,
      )
    }
  })

  test('ordinary untagged API still fails', {timeout: 120_000}, async () => {
    const fixtureDir = await createFixture({
      index: `export function untagged(): string {\n  return 'untagged'\n}\n`,
    })

    await expect(runBuild(fixtureDir)).rejects.toThrow(
      'TSDoc/release-tag check failed with 1 error',
    )
  })

  test.each([
    {
      name: 'an untagged alias',
      aliases:
        `/** @alpha */\nexport * as tagged from './inner'\n` +
        `export * as untagged from './inner'\n`,
    },
    {
      name: 'differently tagged aliases',
      aliases:
        `/** @alpha */\nexport * as alpha from './inner'\n` +
        `/** @beta */\nexport * as beta from './inner'\n`,
    },
  ])(
    'does not tag a shared namespace wrapper when the module also has $name',
    {timeout: 120_000},
    async ({aliases}) => {
      const fixtureDir = await createFixture({
        index: aliases,
        inner: `/** @alpha */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await expect(runBuild(fixtureDir)).rejects.toThrow(
        'TSDoc/release-tag check failed with 1 error',
      )
      expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toMatch(
        /^declare namespace inner_d_exports/,
      )
    },
  )

  test(
    'ignores a tree-shaken conflicting alias when only the tagged alias is re-exported',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        index: `export {tagged} from './barrel'\n`,
        barrel:
          `/** @alpha */\nexport * as tagged from './inner'\n` +
          `export * as untagged from './inner'\n`,
        inner: `/** @alpha */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await runBuild(fixtureDir)
      expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toContain(
        '/** @alpha */ declare namespace inner_d_exports',
      )
    },
  )

  test(
    'finds a tagged namespace re-export through a transitive barrel',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        index: `export * from './barrel'\n`,
        barrel: `/** @beta */\nexport * as inner from './inner'\n`,
        inner: `/** @beta */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await runBuild(fixtureDir)
      expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toContain(
        '/** @beta */ declare namespace inner_d_exports',
      )
    },
  )

  test('preserves multiple type-only namespace release tags', {timeout: 120_000}, async () => {
    const fixtureDir = await createFixture({
      index:
        `/** @public */\nexport type * as first from './first'\n` +
        `/** @public */\nexport type * as second from './second'\n`,
      first: `/** @public */\nexport interface First {value: string}\n`,
      second: `/** @public */\nexport interface Second {value: number}\n`,
    })

    await runBuild(fixtureDir)
    const declaration = await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')
    expect(declaration).toContain('/** @public */ declare namespace first_d_exports')
    expect(declaration).toContain('/** @public */ declare namespace second_d_exports')
  })

  test('combines multiple type-only member exports for structural matching', async () => {
    const sourceId = '/fixture/namespaces.d.mts'
    const firstId = '/fixture/first.d.mts'
    const secondId = '/fixture/second.d.mts'
    const plugin = namespaceReleaseTagPlugin()
    const transform = objectHook(plugin, 'transform')
    const renderChunk = objectHook(plugin, 'renderChunk')
    const context = metadataPluginContextForTargets(sourceId, {
      './first': firstId,
      './second': secondId,
    })
    const sharedChunk = {
      fileName: 'shared.d.mts',
      moduleIds: [firstId, secondId],
      modules: {
        [firstId]: {renderedExports: ['First', 'FirstOptions']},
        [secondId]: {renderedExports: ['Second', 'SecondOptions']},
      },
    } as unknown as Rolldown.RenderedChunk
    const entryChunk = {
      fileName: 'index.d.mts',
      moduleIds: [sourceId],
      modules: {
        [sourceId]: {renderedExports: ['renamedFirst', 'renamedSecond']},
      },
    } as unknown as Rolldown.RenderedChunk
    const declaration =
      `declare namespace first_d_exports {\n` +
      `  export type { First };\n` +
      `  export type { FirstOptions };\n` +
      `}\n` +
      `declare namespace second_d_exports {\n` +
      `  export type { Second };\n` +
      `  export type { SecondOptions };\n` +
      `}\n` +
      `export type { first_d_exports as n, second_d_exports as t };\n`

    await transform.handler.call(
      context,
      `/** @alpha */\nexport type * as first from './first';\n` +
        `/** @beta */\nexport type * as second from './second';\n`,
      sourceId,
      {} as never,
    )
    const rendered = renderedCode(
      await renderChunk.handler.call(
        context,
        declaration,
        sharedChunk,
        {} as never,
        {
          chunks: {
            [entryChunk.fileName]: entryChunk,
            [sharedChunk.fileName]: sharedChunk,
          },
        } as never,
      ),
    )

    expect(rendered).toContain('/** @alpha */ declare namespace first_d_exports')
    expect(rendered).toContain('/** @beta */ declare namespace second_d_exports')
  })

  test(
    'processes a synthesized namespace in a shared declaration chunk',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        a: `export * from './barrel'\n`,
        b: `export * from './barrel'\n`,
        barrel: `/** @internal */\nexport * as inner from './inner'\n`,
        inner: `/** @internal */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await runBuild(fixtureDir, 'esm', {a: './src/a.ts', b: './src/b.ts'})

      const declarationFiles = (await readdir(path.join(fixtureDir, 'dist'))).filter((fileName) =>
        fileName.endsWith('.d.ts'),
      )
      const declarations = await Promise.all(
        declarationFiles.map(async (fileName) => ({
          contents: await readFile(path.join(fixtureDir, 'dist', fileName), 'utf8'),
          fileName,
        })),
      )
      const sharedDeclaration = declarations.find(({contents}) =>
        contents.includes('declare namespace inner_d_exports'),
      )
      expect(sharedDeclaration).toBeDefined()
      if (!sharedDeclaration) throw new Error('Expected a shared namespace declaration chunk')
      expect(sharedDeclaration.contents).toContain(
        '/** @internal */ declare namespace inner_d_exports',
      )

      const sourceMap: {mappings: string; sources: string[]} = JSON.parse(
        await readFile(path.join(fixtureDir, 'dist', `${sharedDeclaration.fileName}.map`), 'utf8'),
      )
      expect(sourceMap.sources).toContain('../src/inner.ts')
      expect(sourceMap.mappings).not.toBe('')
    },
  )

  test(
    'ignores a tree-shaken conflicting alias for a shared wrapper',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        a: `export {tagged} from './barrel'\n`,
        b: `export {tagged} from './barrel'\n`,
        barrel:
          `/** @internal */\nexport * as tagged from './inner'\n` +
          `export * as untagged from './inner'\n`,
        inner: `/** @internal */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await runBuild(fixtureDir, 'esm', {a: './src/a.ts', b: './src/b.ts'})
      const declarations = await Promise.all(
        (await readdir(path.join(fixtureDir, 'dist')))
          .filter((fileName) => fileName.endsWith('.d.ts'))
          .map(async (fileName) => readFile(path.join(fixtureDir, 'dist', fileName), 'utf8')),
      )
      expect(
        declarations.find((declaration) =>
          declaration.includes('declare namespace inner_d_exports'),
        ),
      ).toContain('/** @internal */ declare namespace inner_d_exports')
    },
  )

  test(
    'matches two shared type-only wrappers through transitive renamed barrels',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        a: `export type {renamedFirst, renamedSecond} from './barrel'\n`,
        b: `export type {renamedFirst, renamedSecond} from './barrel'\n`,
        barrel: `export type {first as renamedFirst, second as renamedSecond} from './namespaces'\n`,
        namespaces:
          `/** @alpha */\nexport type * as first from './first'\n` +
          `/** @beta */\nexport type * as second from './second'\n`,
        first:
          `/** @alpha */\nexport interface First {value: string}\n` +
          `/** @alpha */\nexport interface FirstOptions {optional?: boolean}\n`,
        second:
          `/** @beta */\nexport interface Second {value: number}\n` +
          `/** @beta */\nexport interface SecondOptions {optional?: boolean}\n`,
      })

      await runBuild(fixtureDir, 'esm', {a: './src/a.ts', b: './src/b.ts'})
      const declarations = await Promise.all(
        (await readdir(path.join(fixtureDir, 'dist')))
          .filter((fileName) => fileName.endsWith('.d.ts'))
          .map(async (fileName) => readFile(path.join(fixtureDir, 'dist', fileName), 'utf8')),
      )
      const sharedDeclaration = declarations.find(
        (declaration) =>
          declaration.includes('declare namespace first_d_exports') &&
          declaration.includes('declare namespace second_d_exports'),
      )
      expect(sharedDeclaration).toContain('/** @alpha */ declare namespace first_d_exports')
      expect(sharedDeclaration).toContain('/** @beta */ declare namespace second_d_exports')
    },
  )

  test(
    'reads an authored declaration entry instead of its TypeScript sibling with dtsInput',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        'index.d.ts': `/** @alpha */\nexport * as inner from './inner'\n`,
        'index.ts': `/** @beta */\nexport * as inner from './inner'\n`,
        'inner.d.ts': `/** @alpha */\nexport declare function hello(): string\n`,
        'inner.ts': `/** @beta */\nexport function hello(): string {\n  return 'hello'\n}\n`,
      })

      await runBuild(fixtureDir, 'esm', './src/index.d.ts', {
        dts: {dtsInput: true, newContext: true, sourcemap: true},
      })
      const declaration = await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')
      expect(declaration).toContain('/** @alpha */ declare namespace inner_d_exports')
      expect(declaration).not.toContain('/** @beta */ declare namespace inner_d_exports')
    },
  )

  test('supports a non-ASCII namespace alias', {timeout: 120_000}, async () => {
    const fixtureDir = await createFixture({
      index: `/** @public */\nexport * as 日本語 from './日本語'\n`,
      日本語: `/** @public */\nexport function hello(): string {\n  return 'hello'\n}\n`,
    })

    await runBuild(fixtureDir)
    expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toContain(
      '/** @public */ declare namespace 日本語_d_exports',
    )
  })

  test('supports extensionless entry paths', {timeout: 120_000}, async () => {
    const fixtureDir = await createFixture({
      index: `/** @public */\nexport * as inner from './inner'\n`,
      inner: `/** @public */\nexport function hello(): string {\n  return 'hello'\n}\n`,
    })

    await runBuild(fixtureDir, 'esm', './src/index')
    expect(await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf8')).toContain(
      '/** @public */ declare namespace inner_d_exports',
    )
  })

  test('replaces and deletes declaration metadata across watch updates', async () => {
    const sourceId = '/fixture/index.d.cts'
    const targetId = '/fixture/inner.d.cts'
    const plugin = namespaceReleaseTagPlugin()
    const transform = objectHook(plugin, 'transform')
    const renderChunk = objectHook(plugin, 'renderChunk')
    const context = metadataPluginContext(sourceId, targetId)
    const chunk = metadataChunk('index.d.cts', sourceId, targetId)

    await transform.handler.call(
      context,
      `/** @alpha */\nexport * as inner from './inner';\n`,
      sourceId,
      {} as never,
    )
    expect(
      renderedCode(
        await renderChunk.handler.call(
          context,
          renderedNamespace,
          chunk,
          {} as never,
          renderMetadata(chunk),
        ),
      ),
    ).toContain('/** @alpha */ declare namespace inner_d_exports')
    await expect(
      renderChunk.handler.call(
        context,
        `/** @alpha */ ${renderedNamespace}`,
        chunk,
        {} as never,
        renderMetadata(chunk),
      ),
    ).resolves.toBeUndefined()

    await transform.handler.call(
      context,
      `/** @beta */\nexport * as inner from './inner';\n`,
      sourceId,
      {} as never,
    )
    expect(
      renderedCode(
        await renderChunk.handler.call(
          context,
          renderedNamespace,
          chunk,
          {} as never,
          renderMetadata(chunk),
        ),
      ),
    ).toContain('/** @beta */ declare namespace inner_d_exports')

    await transform.handler.call(
      context,
      `/** @public */\nexport interface Ordinary {}\n`,
      sourceId,
      {} as never,
    )
    await expect(
      renderChunk.handler.call(
        context,
        renderedNamespace,
        chunk,
        {} as never,
        renderMetadata(chunk),
      ),
    ).resolves.toBeUndefined()

    await transform.handler.call(
      context,
      `/** @internal */\nexport * as inner from './inner';\n`,
      sourceId,
      {} as never,
    )
    const watchChange = plugin.watchChange
    expect(watchChange).toBeTypeOf('function')
    if (typeof watchChange !== 'function') return
    await watchChange.call(context, sourceId, {event: 'delete'})
    await expect(
      renderChunk.handler.call(
        context,
        renderedNamespace,
        chunk,
        {} as never,
        renderMetadata(chunk),
      ),
    ).resolves.toBeUndefined()
  })

  test('isolates one plugin instance by concurrent declaration contexts', async () => {
    const sourceId = '/fixture/index.d.mts'
    const targetId = '/fixture/inner.d.mts'
    const chunk = metadataChunk('index.d.mts', sourceId, targetId)
    const plugin = namespaceReleaseTagPlugin()
    const transform = objectHook(plugin, 'transform')
    const renderChunk = objectHook(plugin, 'renderChunk')
    const alphaContext = metadataPluginContext(sourceId, targetId)
    const betaContext = metadataPluginContext(sourceId, targetId)

    await Promise.all([
      transform.handler.call(
        alphaContext,
        `/** @alpha */\nexport * as inner from './inner';\n`,
        sourceId,
        {} as never,
      ),
      transform.handler.call(
        betaContext,
        `/** @beta */\nexport * as inner from './inner';\n`,
        sourceId,
        {} as never,
      ),
    ])
    const [alphaResult, betaResult] = await Promise.all([
      renderChunk.handler.call(
        alphaContext,
        renderedNamespace,
        chunk,
        {} as never,
        renderMetadata(chunk),
      ),
      renderChunk.handler.call(
        betaContext,
        renderedNamespace,
        chunk,
        {} as never,
        renderMetadata(chunk),
      ),
    ])

    expect(renderedCode(alphaResult)).toContain('/** @alpha */ declare namespace inner_d_exports')
    expect(renderedCode(betaResult)).toContain('/** @beta */ declare namespace inner_d_exports')
  })

  test('returns before parser, resolution, or module inspection for ordinary declarations', async () => {
    const plugin = namespaceReleaseTagPlugin()
    const transform = objectHook(plugin, 'transform')
    const renderChunk = objectHook(plugin, 'renderChunk')
    const inaccessibleContext = new Proxy(
      {},
      {
        get() {
          throw new Error('plugin context should not be inspected')
        },
      },
    ) as never

    await expect(
      transform.handler.call(
        inaccessibleContext,
        `/** @public */\nexport declare function hello(): string;\n`,
        '/fixture/index.d.ts',
        {} as never,
      ),
    ).resolves.toBeUndefined()

    const ordinaryChunk = {
      fileName: 'index.d.ts',
      get moduleIds(): never {
        throw new Error('moduleIds should not be read')
      },
    }
    await expect(
      renderChunk.handler.call(
        inaccessibleContext,
        `/** @public */\ndeclare function hello(): string;\nexport {hello};\n`,
        ordinaryChunk as never,
        {} as never,
        {} as never,
      ),
    ).resolves.toBeUndefined()
  })
})

const renderedNamespace =
  `declare namespace inner_d_exports {\n  export { hello };\n}\n` +
  `/** @public */\ndeclare function hello(): string;\n` +
  `export { inner_d_exports as inner };\n`

function objectHook<Name extends 'transform' | 'renderChunk'>(
  plugin: Rolldown.Plugin,
  name: Name,
): Extract<NonNullable<Rolldown.Plugin[Name]>, {handler: unknown}> {
  const hook = plugin[name]
  if (!hook || typeof hook === 'function') throw new Error(`Expected an object ${name} hook`)
  return hook as Extract<NonNullable<Rolldown.Plugin[Name]>, {handler: unknown}>
}

function metadataPluginContext(sourceId: string, targetId: string): never {
  return metadataPluginContextForTargets(sourceId, {'./inner': targetId})
}

function metadataPluginContextForTargets(sourceId: string, targets: Record<string, string>): never {
  const targetIds = new Set(Object.values(targets))
  return {
    async resolve(moduleSpecifier: string) {
      const id = targets[moduleSpecifier]
      return id ? {external: false, id} : null
    },
    getModuleInfo(id: string) {
      return id === sourceId || targetIds.has(id) ? ({id, meta: {}} as never) : null
    },
  } as never
}

function metadataChunk(
  fileName: string,
  sourceId: string,
  targetId: string,
): Rolldown.RenderedChunk {
  return {
    facadeModuleId: sourceId,
    fileName,
    isEntry: true,
    moduleIds: [sourceId, targetId],
    modules: {
      [sourceId]: {renderedExports: ['inner']},
      [targetId]: {renderedExports: ['hello']},
    },
  } as Rolldown.RenderedChunk
}

function renderMetadata(chunk: Rolldown.RenderedChunk): never {
  return {chunks: {[chunk.fileName]: chunk}} as never
}

function renderedCode(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || !('code' in result)) return undefined
  return typeof result.code === 'string' ? result.code : undefined
}

async function createFixture(files: Record<string, string>): Promise<string> {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'tsdown-namespace-release-tag-'))
  fixtureDirs.push(fixtureDir)
  await mkdir(path.join(fixtureDir, 'src'))
  await Promise.all([
    writeFile(
      path.join(fixtureDir, 'package.json'),
      `${JSON.stringify({
        name: '@fixtures/namespace-release-tag',
        version: '0.0.0-development',
        private: true,
        type: 'module',
      })}\n`,
    ),
    writeFile(
      path.join(fixtureDir, 'tsconfig.json'),
      `${JSON.stringify({
        compilerOptions: {
          declaration: true,
          module: 'Preserve',
          moduleResolution: 'Bundler',
          strict: true,
          target: 'ES2022',
        },
        include: ['src'],
      })}\n`,
    ),
    ...Object.entries(files).map(([name, contents]) => {
      const fileName = /\.[cm]?[jt]sx?$/.test(name) ? name : `${name}.ts`
      return writeFile(path.join(fixtureDir, 'src', fileName), contents)
    }),
  ])
  return fixtureDir
}

async function runBuild(
  cwd: string,
  format: UserConfig['format'] = 'esm',
  entry: UserConfig['entry'] = './src/index.ts',
  overrides: UserConfig = {},
): Promise<unknown> {
  return build(
    mergeConfig(
      await defineConfig({
        clean: true,
        cwd,
        dts: {newContext: true, sourcemap: true},
        entry,
        exports: false,
        format,
        outDir: 'dist',
        sourcemap: false,
        tsdoc: {rules: {'ae-missing-release-tag': 'error'}},
      }),
      overrides,
      {logLevel: 'silent', publint: false},
    ),
  )
}
