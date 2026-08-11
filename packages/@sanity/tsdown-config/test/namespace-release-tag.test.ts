import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {build, mergeConfig, type UserConfig} from 'tsdown'
import {afterAll, describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

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

  test(
    'does not invent a tag for an untagged namespace re-export',
    {timeout: 120_000},
    async () => {
      const fixtureDir = await createFixture({
        index: `export * as inner from './inner'\n`,
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

  test('ordinary untagged API still fails', {timeout: 120_000}, async () => {
    const fixtureDir = await createFixture({
      index: `export function untagged(): string {\n  return 'untagged'\n}\n`,
    })

    await expect(runBuild(fixtureDir)).rejects.toThrow(
      'TSDoc/release-tag check failed with 1 error',
    )
  })
})

async function createFixture(files: {index: string; inner?: string}): Promise<string> {
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
    writeFile(path.join(fixtureDir, 'src/index.ts'), files.index),
    ...(files.inner === undefined
      ? []
      : [writeFile(path.join(fixtureDir, 'src/inner.ts'), files.inner)]),
  ])
  return fixtureDir
}

async function runBuild(cwd: string, format: UserConfig['format'] = 'esm'): Promise<unknown> {
  return build(
    mergeConfig(
      await defineConfig({
        clean: true,
        cwd,
        dts: {newContext: true, sourcemap: true},
        entry: './src/index.ts',
        exports: false,
        format,
        outDir: 'dist',
        sourcemap: false,
        tsdoc: {rules: {'ae-missing-release-tag': 'error'}},
      }),
      {logLevel: 'silent', publint: false},
    ),
  )
}
