import path from 'node:path'
import type {ExtractorMessage} from '@microsoft/api-extractor'
import {loadConfig} from './core/config/loadConfig.ts'
import type {BuildContext} from './core/contexts/index.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {fileExists} from './fileExists.ts'
import {createLogger, type Logger} from './logger.ts'
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
    const config = await loadConfig({cwd})
    const {parseStrictOptions} = await import('./strict.ts')
    const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
    const pkg = await loadPkgWithReporting({cwd, logger, strict, strictOptions})
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

    // Now use publint to check the package
    await checkWithPublint(cwd, logger)

    if (ctx.config?.extract?.enabled !== false) {
      await checkApiExtractorReleaseTags(ctx)
    }

    spinner.complete()
  } catch (err) {
    spinner.error()

    if (err instanceof Error) {
      const RE_CWD = new RegExp(cwd, 'g')

      logger.error((err.stack || err.message).replace(RE_CWD, '.'))
      logger.log()
    }

    process.exit(1)
  }
}

async function checkWithPublint(cwd: string, logger: Logger) {
  const {publint} = await import('publint')
  const {formatMessage} = await import('publint/utils')
  const {readFileSync} = await import('node:fs')

  const pkgJsonPath = path.resolve(cwd, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))

  const {messages} = await publint({pkgDir: cwd})

  if (messages.length > 0) {
    for (const message of messages) {
      const formatted = formatMessage(message, pkg)

      if (!formatted) continue

      if (message.type === 'error') {
        logger.error(formatted)
      } else if (message.type === 'warning') {
        logger.warn(formatted)
      } else {
        logger.info(formatted)
      }

      logger.log()
    }

    const hasErrors = messages.some((m) => m.type === 'error')
    if (hasErrors) {
      process.exit(1)
    }
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

  const customTags = ctx.config?.extract?.customTags || []
  const bundledPackages = ctx.bundledPackages
  const distPath = ctx.distPath
  const outDir = ctx.ts.config?.options.outDir || distPath
  const rules = ctx.config?.extract?.rules || {}

  for (const exp of Object.values(ctx.exports || {})) {
    if (!exp._exported || !exp.default.endsWith('.js')) continue
    const dtsPath = exp.default.replace(/\.js$/, '.d.ts')
    const exportPath = path.resolve(ctx.cwd, dtsPath)

    // Skip if declaration file doesn't exist (e.g., JavaScript-only projects)
    const {existsSync} = await import('node:fs')
    if (!existsSync(exportPath)) {
      continue
    }

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
