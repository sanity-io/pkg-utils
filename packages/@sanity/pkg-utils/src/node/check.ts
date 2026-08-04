import path from 'node:path'
import type {ExtractorMessage} from '@microsoft/api-extractor'
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
  const [
    {Extractor, ExtractorConfig},
    {createApiExtractorConfig},
    {createTSDocConfig},
    {getExtractMessagesConfig},
    {printExtractMessages},
  ] = await Promise.all([
    import('@microsoft/api-extractor'),
    import('./tasks/dts/createApiExtractorConfig.ts'),
    import('./tasks/dts/createTSDocConfig.ts'),
    import('./tasks/dts/getExtractMessagesConfig.ts'),
    import('./printExtractMessages.ts'),
  ])

  const tsdoc = ctx.config?.tsdoc === false ? undefined : ctx.config?.tsdoc
  const customTags = tsdoc?.customTags || []
  const bundledPackages = ctx.bundledPackages
  const distPath = ctx.distPath
  // api-extractor needs a `compilerOptions.outDir` for its path mapping; tsdown does not, so
  // fall back to the dist folder when the tsconfig leaves it unset
  const outDir = ctx.ts.config?.options.outDir ?? distPath
  const rules = tsdoc?.rules || {}

  for (const exp of Object.values(ctx.exports || {})) {
    if (!exp._exported || !exp.default.endsWith('.js')) continue
    const dtsPath = exp.default.replace(/\.js$/, '.d.ts')
    const exportPath = path.resolve(ctx.cwd, dtsPath)

    // JS-only entries emit no declarations; there is nothing to check
    if (!fileExists(exportPath)) continue

    const tsdocConfigFile = await createTSDocConfig({
      customTags,
    })
    const extractorConfig = ExtractorConfig.prepare({
      configObject: createApiExtractorConfig({
        bundledPackages,
        distPath,
        exportPath,
        filePath: path.relative(outDir, dtsPath),
        messages: getExtractMessagesConfig({rules}),
        projectFolder: ctx.cwd,
        mainEntryPointFilePath: exportPath,
        tsconfig: ctx.ts.config!,
        tsconfigPath: path.resolve(ctx.cwd, ctx.ts.configPath || 'tsconfig.json'),
        dtsRollupEnabled: false,
      }),
      configObjectFullPath: undefined,
      tsdocConfigFile,
      packageJsonFullPath: path.resolve(ctx.cwd, 'package.json'),
    })
    const messages: ExtractorMessage[] = []
    // Invoke API Extractor
    Extractor.invoke(extractorConfig, {
      // Equivalent to the "--local" command-line parameter
      localBuild: true,
      // Equivalent to the "--verbose" command-line parameter
      showVerboseMessages: true,
      // handle messages
      messageCallback(message: ExtractorMessage) {
        messages.push(message)
        message.handled = true
      },
    })

    printExtractMessages(ctx, messages)
  }
}
