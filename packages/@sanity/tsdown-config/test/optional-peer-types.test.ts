import {cp, mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
// TypeScript 7 (Go-native) no longer ships the JS compiler API; use the compat package
import ts from '@typescript/typescript6'
import {x} from 'tinyexec'
import {afterAll, beforeAll, describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(packageDir, '../../..')

/**
 * Typechecks a consumer module against the built `dist/index.d.mts` (built by `pretest`),
 * with resolution failing for `blockedModules` — like a consumer that didn't install those
 * peers. Expected errors carry `@ts-expect-error`, so "no diagnostics" asserts both ways
 * (a vanished expected error fails via the unused directive).
 */
function typecheckConsumer(consumerCode: string, blockedModules: string[]): string {
  // Forward slashes: TypeScript normalizes paths before host callbacks see them, so a
  // backslash path would never match the `===` checks below on Windows
  const consumerPath = path
    .join(packageDir, '__optional-peer-consumer__.ts')
    .replaceAll('\\', '/')
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    strict: true,
    // What makes a missing peer degrade silently instead of erroring with TS2307
    skipLibCheck: true,
    noEmit: true,
    types: [],
  }
  const host = ts.createCompilerHost(compilerOptions, true)
  const defaultFileExists = host.fileExists.bind(host)
  const defaultReadFile = host.readFile.bind(host)
  const defaultGetSourceFile = host.getSourceFile.bind(host)
  host.fileExists = (fileName) => fileName === consumerPath || defaultFileExists(fileName)
  host.readFile = (fileName) => (fileName === consumerPath ? consumerCode : defaultReadFile(fileName))
  host.getSourceFile = (fileName, languageVersionOrOptions, ...rest) =>
    fileName === consumerPath
      ? ts.createSourceFile(fileName, consumerCode, languageVersionOrOptions)
      : defaultGetSourceFile(fileName, languageVersionOrOptions, ...rest)
  host.resolveModuleNameLiterals = (moduleLiterals, containingFile, _redirected, options) =>
    moduleLiterals.map((literal) => {
      // An empty resolution is what a real compiler produces for an uninstalled module
      if (blockedModules.includes(literal.text)) return {resolvedModule: undefined}
      return ts.resolveModuleName(literal.text, containingFile, options, host)
    })

  const program = ts.createProgram({rootNames: [consumerPath], options: compilerOptions, host})
  const consumerFile = program.getSourceFile(consumerPath)
  if (!consumerFile) return expect.unreachable('expected the consumer source file')
  const diagnostics = [
    ...program.getSyntacticDiagnostics(consumerFile),
    ...program.getSemanticDiagnostics(consumerFile),
  ]
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => packageDir,
    getNewLine: () => '\n',
  })
}

/** The consumer imports the built declarations, like an npm install of this package. */
const consumerPreamble = `
import {defineConfig} from './dist/index.mjs'
import type {UserConfig} from 'tsdown'
`

describe('optional peer dependency typings', () => {
  test('a consumer without babel-plugin-react-compiler keeps working types', () => {
    // The sanity-io/ui scenario: only oxc installed. The missing babel typings must not
    // collapse the union — every config used to resolve to the `Promise<UserConfig[]>`
    // overload unless consumers stubbed the module.
    const diagnostics = typecheckConsumer(
      `${consumerPreamble}
// A non-reactServer oxc config resolves to a single tsdown config
const single: Promise<UserConfig> = defineConfig({
  entry: {index: './src/index.ts'},
  styledComponents: true,
  reactCompiler: {target: '18', transform: 'oxc'},
})

// reactServer: true still selects the dual-build overload, on both branches
const dual: Promise<UserConfig[]> = defineConfig({
  reactCompiler: {target: '18', transform: 'oxc', reactServer: true},
})
const babelDual: Promise<UserConfig[]> = defineConfig({
  reactCompiler: {transform: 'babel', reactServer: true},
})

// The installed oxc branch keeps its real option typings
// @ts-expect-error -- 'nope' is not a React Compiler target
const invalidTarget = defineConfig({reactCompiler: {transform: 'oxc', target: 'nope'}})

// The uninstalled babel branch degrades to transform/reactServer
// @ts-expect-error -- babel compiler options don't resolve without the package
const babelDegraded = defineConfig({reactCompiler: {compilationMode: 'infer'}})

export {babelDegraded, babelDual, dual, invalidTarget, single}
`,
      ['babel-plugin-react-compiler'],
    )
    expect(diagnostics).toBe('')
  })

  test('a consumer without oxc-transform-react keeps working types', () => {
    // The mirror image: only babel installed (the default `transform: 'babel'` setup)
    const diagnostics = typecheckConsumer(
      `${consumerPreamble}
const single: Promise<UserConfig> = defineConfig({
  reactCompiler: {target: '18', compilationMode: 'infer'},
})

const dual: Promise<UserConfig[]> = defineConfig({
  reactCompiler: {target: '18', reactServer: true},
})

// The installed babel branch keeps its real option typings
// @ts-expect-error -- 'nope' is not a compilationMode
const invalidMode = defineConfig({reactCompiler: {compilationMode: 'nope'}})

// The uninstalled oxc branch degrades to transform/reactServer
// @ts-expect-error -- oxc compiler options don't resolve without the package
const oxcDegraded = defineConfig({reactCompiler: {transform: 'oxc', compilationMode: 'infer'}})

export {dual, invalidMode, oxcDegraded, single}
`,
      ['oxc-transform-react'],
    )
    expect(diagnostics).toBe('')
  })

  test('a consumer with neither compiler installed keeps working overloads', () => {
    const diagnostics = typecheckConsumer(
      `${consumerPreamble}
const enabled: Promise<UserConfig> = defineConfig({reactCompiler: true})
const single: Promise<UserConfig> = defineConfig({reactCompiler: {transform: 'oxc'}})
const dual: Promise<UserConfig[]> = defineConfig({reactCompiler: {reactServer: true}})

// Compiler options only typecheck once an implementation is installed
// @ts-expect-error -- no compiler package is installed
const degraded = defineConfig({reactCompiler: {compilationMode: 'infer'}})

export {degraded, dual, enabled, single}
`,
      ['babel-plugin-react-compiler', 'oxc-transform-react'],
    )
    expect(diagnostics).toBe('')
  })

  test('a consumer with both compilers installed keeps full option fidelity', () => {
    const diagnostics = typecheckConsumer(
      `${consumerPreamble}
// Babel-only option shapes resolve: the event logger and a function-valued sources filter
const babel: Promise<UserConfig> = defineConfig({
  reactCompiler: {
    target: '18',
    compilationMode: 'infer',
    logger: {logEvent: () => {}},
    sources: (filename) => filename.includes('src'),
  },
})

// oxc option shapes resolve too, including the nested environment options
const oxc: Promise<UserConfig> = defineConfig({
  reactCompiler: {transform: 'oxc', environment: {customMacros: ['macro']}},
})

const dual: Promise<UserConfig[]> = defineConfig({
  reactCompiler: {target: '19', reactServer: true},
})

// @ts-expect-error -- 'nope' is not a React Compiler target
const invalidTarget = defineConfig({reactCompiler: {transform: 'oxc', target: 'nope'}})

// @ts-expect-error -- function-valued sources filters don't cross oxc's native boundary
const invalidSources = defineConfig({reactCompiler: {transform: 'oxc', sources: () => true}})

export {babel, dual, invalidSources, invalidTarget, oxc}
`,
      [],
    )
    expect(diagnostics).toBe('')
  })
})

describe('typescript 7 consumer', () => {
  let fixtureDir: string | undefined

  beforeAll(async () => {
    // Same ui-shaped consumer, but through the Go-native TypeScript 7 `tsc` (a separate
    // checker implementation). Lives outside the workspace: inside it, node_modules lookups
    // would always find the "missing" package somewhere up the tree.
    fixtureDir = await mkdtemp(path.join(tmpdir(), 'tsdown-config-optional-peers-'))
    const nodeModules = path.join(fixtureDir, 'node_modules')
    const packagedDir = path.join(nodeModules, '@sanity/tsdown-config')
    const vanillaExtractStubDir = path.join(nodeModules, '@sanity/vanilla-extract-tsdown-plugin')
    await mkdir(packagedDir, {recursive: true})
    await mkdir(vanillaExtractStubDir, {recursive: true})

    // The package as published: the real dist, copied (not symlinked — tsc realpaths
    // symlinks, and lookups from the real location would find babel again)
    await cp(path.join(packageDir, 'dist'), path.join(packagedDir, 'dist'), {recursive: true})
    await writeFile(
      path.join(packagedDir, 'package.json'),
      JSON.stringify({
        name: '@sanity/tsdown-config',
        version: '0.0.0-test',
        type: 'module',
        types: './dist/index.d.mts',
        exports: {'.': './dist/index.mjs', './package.json': './package.json'},
      }),
    )
    for (const dependency of ['tsdown', 'oxc-transform-react']) {
      await symlink(
        path.join(packageDir, 'node_modules', dependency),
        path.join(nodeModules, dependency),
        'junction',
      )
    }
    // A stub keeps the vanilla-extract plugin's source tree out of the program; only its
    // two type names are referenced and this fixture never uses them
    await writeFile(
      path.join(vanillaExtractStubDir, 'package.json'),
      JSON.stringify({
        name: '@sanity/vanilla-extract-tsdown-plugin',
        version: '0.0.0-test',
        type: 'module',
        types: './index.d.ts',
      }),
    )
    await writeFile(
      path.join(vanillaExtractStubDir, 'index.d.ts'),
      'export type Options = Record<string, unknown>\nexport type CssExportsOptions = Record<string, unknown>\n',
    )

    await writeFile(
      path.join(fixtureDir, 'tsconfig.json'),
      JSON.stringify({
        include: ['./tsdown.config.mts'],
        compilerOptions: {
          module: 'Preserve',
          moduleDetection: 'force',
          target: 'ESNext',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          types: [],
        },
      }),
    )
    // sanity-io/ui's themer config, minus the stub it needed before this fix
    await writeFile(
      path.join(fixtureDir, 'tsdown.config.mts'),
      `import {defineConfig} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'

const config: UserConfig = await defineConfig({
  entry: {index: './src/index.ts'},
  styledComponents: true,
  reactCompiler: {target: '18', transform: 'oxc'},
})

const dual: Promise<UserConfig[]> = defineConfig({
  reactCompiler: {transform: 'oxc', reactServer: true},
})

// @ts-expect-error -- 'nope' is not a React Compiler target
const invalidTarget = defineConfig({reactCompiler: {transform: 'oxc', target: 'nope'}})

// @ts-expect-error -- babel compiler options don't resolve without the package
const babelDegraded = defineConfig({reactCompiler: {compilationMode: 'infer'}})

export default config
export {babelDegraded, dual, invalidTarget}
`,
    )
  })

  afterAll(async () => {
    // `beforeAll` can throw before `mkdtemp` assigns it
    if (fixtureDir) await rm(fixtureDir, {recursive: true, force: true})
  })

  test('the ui consumer typechecks without babel-plugin-react-compiler installed', async () => {
    if (!fixtureDir) expect.unreachable('expected the fixture directory')
    // The catalog `typescript` bin is a node script; spawn through `node` for portability
    const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')
    const result = await x('node', [tsc, '-p', 'tsconfig.json'], {nodeOptions: {cwd: fixtureDir}})
    expect(result.stdout + result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  })
})
