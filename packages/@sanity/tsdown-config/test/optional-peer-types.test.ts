import {cp, mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
// The JS compiler API is loaded from the official `@typescript/typescript6` compat package
// instead of the `typescript` peer dependency, as TypeScript 7 (the Go-native compiler) no
// longer ships it
import ts from '@typescript/typescript6'
import {x} from 'tinyexec'
import {afterAll, beforeAll, describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(packageDir, '../../..')

/**
 * Typechecks a consumer module against the built `dist/index.d.mts` (what npm consumers
 * see — `test/globalSetup.ts` builds it) with module resolution failing for
 * `blockedModules`, exactly like a consumer that did not install those optional peer
 * dependencies. Everything else resolves for real from this package's `node_modules`.
 *
 * Expected errors are marked with `@ts-expect-error` in the consumer source, so a single
 * "no diagnostics" assertion covers both directions: a degradation that produces new errors
 * fails, and one that stops producing an expected error fails through the unused directive.
 */
function typecheckConsumer(consumerCode: string, blockedModules: string[]): string {
  const consumerPath = path.join(packageDir, '__optional-peer-consumer__.ts')
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    strict: true,
    // What makes a missing optional peer degrade silently instead of erroring with
    // TS2307 — the compiler setting this package's consumers run with
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
      // An empty resolution is exactly what a consumer's compiler produces for a module
      // that is not installed
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
    // The https://github.com/sanity-io/ui scenario: only `oxc-transform-react` is installed,
    // and the unresolvable `babel-plugin-react-compiler` typings must not collapse the
    // `ReactCompilerOptions` union into `any` — which used to make every `reactCompiler`
    // config match the `reactServer: true` overload and resolve to `Promise<UserConfig[]>`,
    // forcing consumers to stub the module themselves (sanity-io/ui#2957's
    // `typings/babel-plugin-react-compiler.d.ts`).
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

// The uninstalled babel branch degrades to transform/reactServer: its compiler options
// only typecheck once the package is installed
// @ts-expect-error -- babel compiler options don't resolve without the package
const babelDegraded = defineConfig({reactCompiler: {compilationMode: 'infer'}})

export {babelDegraded, babelDual, dual, invalidTarget, single}
`,
      ['babel-plugin-react-compiler'],
    )
    expect(diagnostics).toBe('')
  })

  test('a consumer without oxc-transform-react keeps working types', () => {
    // The mirror image: only `babel-plugin-react-compiler` is installed (the default
    // `transform: 'babel'` setup, e.g. `reactCompiler: true` users)
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

// Compiler options don't typecheck until an implementation is installed — which is also
// when they'd first work at runtime
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
  let fixtureDir: string

  beforeAll(async () => {
    // The compiler-API tests above run on the JS checker (`@typescript/typescript6`); this
    // fixture runs the same sanity-io/ui-shaped consumer through the Go-native `tsc` of the
    // `typescript` peer range's other major (the workspace catalog version), whose error
    // recovery for unresolvable heritage clauses is a separate implementation. It lives
    // outside the workspace because inside it, node_modules lookups would always find the
    // "missing" compiler package somewhere up the tree.
    fixtureDir = await mkdtemp(path.join(tmpdir(), 'tsdown-config-optional-peers-'))
    const nodeModules = path.join(fixtureDir, 'node_modules')
    const packagedDir = path.join(nodeModules, '@sanity/tsdown-config')
    const vanillaExtractStubDir = path.join(nodeModules, '@sanity/vanilla-extract-tsdown-plugin')
    await mkdir(packagedDir, {recursive: true})
    await mkdir(vanillaExtractStubDir, {recursive: true})

    // The package under test, shaped like its published form: the real built dist behind
    // the publishConfig exports. dist is copied (not symlinked — the compiler realpaths
    // symlinks, and module lookups from the real location would find the "missing"
    // babel-plugin-react-compiler up the workspace tree). tsdown and oxc-transform-react
    // resolve for real; babel-plugin-react-compiler is nowhere to be found.
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
    // Only `Options` and `CssExportsOptions` are referenced from the built declarations,
    // and nothing in this fixture uses the vanillaExtract/css options — a stub keeps the
    // plugin's source tree (and its whole dependency graph) out of the program.
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
    // The consumer sanity-io/ui's themer package ships (sans the
    // `typings/babel-plugin-react-compiler.d.ts` stub it needed before this could
    // typecheck), plus probes for the dual-build overload and both branches' degradation
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
    await rm(fixtureDir, {recursive: true, force: true})
  })

  test('the ui consumer typechecks without babel-plugin-react-compiler installed', async () => {
    // The catalog `typescript` (a 7.x, resolved from the workspace root) — its bin is a
    // node script, spawned through `node` so the test stays portable
    const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc')
    const result = await x('node', [tsc, '-p', 'tsconfig.json'], {nodeOptions: {cwd: fixtureDir}})
    expect(result.stdout + result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  })
})
