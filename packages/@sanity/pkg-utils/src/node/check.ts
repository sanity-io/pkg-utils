import path from 'node:path'
import type {ExtractorMessage} from '@microsoft/api-extractor'
import {up as findPkgPath} from 'empathic/package'
import type {BuildFailure, Message} from 'esbuild'
import {createConsoleSpy} from './consoleSpy.ts'
import {loadConfig} from './core/config/loadConfig.ts'
import type {BuildContext} from './core/contexts/index.ts'
import {getSourcePath} from './core/exportUtils.ts'
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
        const sourcePath = getSourcePath(exp)
        if (sourcePath && !fileExists(path.resolve(cwd, sourcePath))) {
          missingFiles.push(sourcePath)
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

      // Check if the files are resolved
      const exportPaths: {require: string[]; import: string[]} = {
        require: [],
        import: [],
      }

      for (const exp of Object.values(ctx.exports || {})) {
        if (!exp._exported) continue
        if (exp.require) exportPaths.require.push(exp.require)
        if (exp.import) exportPaths.import.push(exp.import)
      }

      const external = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ]

      const consoleSpy = createConsoleSpy()

      const checks = []
      if (exportPaths.import.length) {
        checks.push(checkExports(exportPaths.import, {cwd, external, format: 'esm', logger}))
      }

      if (exportPaths.require.length) {
        checks.push(checkExports(exportPaths.require, {cwd, external, format: 'cjs', logger}))
      }

      await Promise.all(checks)

      consoleSpy.restore()
    }

    if (ctx.dts === 'rolldown' && ctx.config?.extract?.enabled !== false) {
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

async function checkExports(
  exportPaths: string[],
  options: {cwd: string; external: string[]; format: 'esm' | 'cjs'; logger: Logger},
) {
  const {build} = await import('esbuild')
  const {cwd, external, format, logger} = options

  const code = exportPaths
    .map((id) => (format ? `import('${id}');` : `require('${id}');`))
    .join('\n')

  try {
    const esbuildResult = await build({
      bundle: true,
      external,
      format,
      logLevel: 'silent',
      // otherwise output maps to stdout as we're using stdin
      outfile: '/dev/null',
      platform: 'node',
      // We're not interested in CSS files that might be imported as a side effect, so we'll treat them as empty
      loader: {'.css': 'empty'},
      stdin: {
        contents: code,
        loader: 'js',
        resolveDir: cwd,
      },
    })

    if (esbuildResult.errors.length > 0) {
      for (const msg of esbuildResult.errors) {
        printEsbuildMessage(logger.warn, msg)

        logger.log()
      }

      process.exit(1)
    }

    const esbuildWarnings = esbuildResult.warnings.filter((msg) => {
      return !(msg.detail || msg.text).includes(`does not affect esbuild's own target setting`)
    })

    for (const msg of esbuildWarnings) {
      printEsbuildMessage(logger.warn, msg)

      logger.log()
    }
  } catch (err) {
    if (isEsbuildFailure(err)) {
      const {errors} = err

      for (const msg of errors) {
        printEsbuildMessage(logger.error, msg)

        logger.log()
      }
    } else if (err instanceof Error) {
      logger.error(err.stack || err.message)

      logger.log()
    } else {
      logger.error(String(err))

      logger.log()
    }

    process.exit(1)
  }
}

function printEsbuildMessage(log: (...args: unknown[]) => void, msg: Message) {
  if (msg.location) {
    log(
      [
        `${msg.detail || msg.text}\n`,
        `${msg.location.line} | ${msg.location.lineText}\n`,
        `in ./${msg.location.file}:${msg.location.line}:${msg.location.column}`,
      ].join(''),
    )
  } else {
    log(msg.detail || msg.text)
  }
}

function isEsbuildFailure(err: unknown): err is BuildFailure {
  return (
    err instanceof Error &&
    'errors' in err &&
    Array.isArray(err.errors) &&
    err.errors.every(isEsbuildMessage) &&
    'warnings' in err &&
    Array.isArray(err.warnings) &&
    err.warnings.every(isEsbuildMessage)
  )
}

function isEsbuildMessage(msg: unknown): msg is Message {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'text' in msg &&
    typeof msg.text === 'string' &&
    'location' in msg &&
    (msg.location === null || typeof msg.location === 'object')
  )
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
  const outDir = ctx.ts.config?.options.outDir
  const rules = ctx.config?.extract?.rules || {}

  if (!outDir) {
    throw new Error('tsconfig.json is missing `compilerOptions.outDir`')
  }

  for (const exp of Object.values(ctx.exports || {})) {
    if (!exp._exported || !exp.default.endsWith('.js')) continue
    const dtsPath = exp.default.replace(/\.js$/, '.d.ts')
    const exportPath = path.resolve(ctx.cwd, dtsPath)

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
