import path from 'node:path'
import {checkTsdoc} from '@sanity/tsdown-config'
import {up as findPkgPath} from 'empathic/package'
import {loadConfig} from './core/config/loadConfig.ts'
import type {BuildContext} from './core/contexts/buildContext.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {fileExists} from './fileExists.ts'
import {createLogger} from './logger.ts'
import {printPackageTree} from './printPackageTree.ts'
import {resolveBuildContext} from './resolveBuildContext.ts'
import {createSpinner} from './spinner.ts'

/** @public */
export async function check(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption} = options
  const logger = createLogger()
  const spinner = createSpinner('')
  try {
    const pkgPath = findPkgPath({cwd})
    if (!pkgPath) {
      throw new Error('no package.json found', {cause: {cwd}})
    }
    const config = await loadConfig({cwd, pkgPath})
    const {parseStrictOptions} = await import('./strict.ts')
    const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
    const pkg = await loadPkgWithReporting({pkgPath, logger, strict, strictOptions})
    const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'
    const ctx = await resolveBuildContext({config, cwd, logger, pkg, strict, tsconfig})

    printPackageTree(ctx)

    if (strict) {
      const missingFiles: string[] = []

      // Check if there are missing files
      for (const [, exp] of Object.entries(ctx.exports || {})) {
        if (exp.source && !fileExists(path.resolve(cwd, exp.source))) {
          missingFiles.push(exp.source)
        }

        if (exp.require && !fileExists(path.resolve(cwd, exp.require))) {
          missingFiles.push(exp.require)
        }

        if (exp.import && !fileExists(path.resolve(cwd, exp.import))) {
          missingFiles.push(exp.import)
        }
      }

      if (ctx.pkg.types && !fileExists(path.resolve(cwd, ctx.pkg.types))) {
        missingFiles.push(ctx.pkg.types)
      }

      if (missingFiles.length) {
        logger.error(`missing files: ${missingFiles.join(', ')}`)
        process.exit(1)
      }
    }

    // publint validates that the built package resolves in every runtime/bundler — it packs
    // the package (which applies `publishConfig`, so the source-condition convention checks
    // out the way consumers see it) and lints the result. This replaced the bespoke
    // esbuild-based resolution checks of previous majors.
    await runPublint(ctx)

    if (ctx.config?.tsdoc !== false) {
      await checkApiExtractorReleaseTags(ctx)
    }

    spinner.complete()
  } catch (err) {
    spinner.error()

    if (err instanceof Error) {
      const RE_CWD = new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')

      logger.error((err.stack || err.message).replace(RE_CWD, '.'))
      logger.log()
    }

    process.exit(1)
  }
}

async function runPublint(ctx: BuildContext): Promise<void> {
  const {cwd, logger, strict} = ctx
  const [{publint}, {formatMessage}] = await Promise.all([
    import('publint'),
    import('publint/utils'),
  ])

  const {messages, pkg} = await publint({pkgDir: cwd, strict})

  let hasErrors = false

  for (const message of messages) {
    const formatted = formatMessage(message, pkg)
    if (message.type === 'error') {
      hasErrors = true
      logger.error(`publint: ${formatted}`)
    } else if (message.type === 'warning') {
      logger.warn(`publint: ${formatted}`)
    } else {
      logger.log(`publint: ${formatted}`)
    }
  }

  if (hasErrors) {
    process.exit(1)
  }
}

async function checkApiExtractorReleaseTags(ctx: BuildContext) {
  const tsdoc =
    ctx.config?.tsdoc === false || ctx.config?.tsdoc === true ? undefined : ctx.config?.tsdoc
  const entryDtsFiles: string[] = []
  const seen = new Set<string>()

  for (const exp of Object.values(ctx.exports || {})) {
    if (!exp._exported) continue
    // Prefer an explicit `types` condition; otherwise derive declarations from every runtime
    // file (`.js` → `.d.ts`, `.mjs` → `.d.mts`, `.cjs` → `.d.cts`) so dual-format / fixed-
    // extension packages are checked the same way as the build-time `tsdoc` hook.
    const candidates = new Set<string>()
    if (exp.types) candidates.add(exp.types)
    for (const js of [exp.default, exp.import, exp.require]) {
      if (!js) continue
      const dts = jsFileToDts(js)
      if (dts) candidates.add(dts)
    }
    for (const dtsPath of candidates) {
      const exportPath = path.resolve(ctx.cwd, dtsPath)
      // JS-only entries emit no declarations; there is nothing to check
      if (!fileExists(exportPath) || seen.has(exportPath)) continue
      seen.add(exportPath)
      entryDtsFiles.push(exportPath)
    }
  }

  if (entryDtsFiles.length === 0) return

  await checkTsdoc({
    cwd: ctx.cwd,
    entryDtsFiles,
    tsconfig: ctx.ts.configPath || 'tsconfig.json',
    outDir: ctx.ts.config?.options.outDir ?? ctx.distPath,
    bundledPackages: ctx.bundledPackages,
    customTags: tsdoc?.customTags,
    rules: tsdoc?.rules,
    logger: {
      log: (...args) => ctx.logger.log(...args),
      warn: (...args) => ctx.logger.warn(...args),
      error: (...args) => ctx.logger.error(...args),
    },
  })
}

/** `./dist/index.js` → `./dist/index.d.ts` (`.mjs` → `.d.mts`, `.cjs` → `.d.cts`). */
function jsFileToDts(file: string): string | undefined {
  if (/\.d\.[mc]?ts$/.test(file)) return file
  if (file.endsWith('.mjs')) return file.replace(/\.mjs$/, '.d.mts')
  if (file.endsWith('.cjs')) return file.replace(/\.cjs$/, '.d.cts')
  if (file.endsWith('.js')) return file.replace(/\.js$/, '.d.ts')
  return undefined
}
