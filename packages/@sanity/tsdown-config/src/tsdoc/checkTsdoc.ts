import {existsSync} from 'node:fs'
import path from 'node:path'
import {
  Extractor,
  ExtractorConfig,
  ExtractorLogLevel,
  type ExtractorMessage,
} from '@microsoft/api-extractor'
// The JS compiler API is loaded from the official `@typescript/typescript6` compat package
// instead of the `typescript` peer dependency, as TypeScript 7 (the Go-native compiler) no longer
// ships it
import ts from '@typescript/typescript6'
import {createApiExtractorConfig} from './createApiExtractorConfig.ts'
import {createTSDocConfig} from './createTSDocConfig.ts'
import {getExtractMessagesConfig} from './getExtractMessagesConfig.ts'
import type {PackageTsdocOptions} from './types.ts'

/** @public */
export interface CheckTsdocLogger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/** @public */
export interface CheckTsdocOptions extends PackageTsdocOptions {
  /** Package root (directory containing `package.json`). */
  cwd: string
  /**
   * Absolute paths to the entry `.d.ts` / `.d.mts` / `.d.cts` files to check.
   * JS-only entries with no declarations are skipped automatically when listed.
   */
  entryDtsFiles: string[]
  /**
   * Path to the tsconfig used for the build, relative to `cwd` or absolute.
   * @defaultValue `'tsconfig.json'`
   */
  tsconfig?: string
  /**
   * Directory of distributed files (used for API Extractor's path mapping). Defaults to the
   * common parent of `entryDtsFiles`, or `dist` under `cwd` when the list is empty.
   */
  outDir?: string
  /**
   * When provided, messages are printed through this logger. Errors throw after reporting so
   * callers (and tsdown's `build:done` hook) fail the build.
   */
  logger?: CheckTsdocLogger
}

/** @public */
export interface CheckTsdocResult {
  messages: ExtractorMessage[]
  errorCount: number
  warningCount: number
}

/**
 * Run `@microsoft/api-extractor` against the given entry declaration files to check that TSDoc
 * tags are valid and release tags are correct. Used by the `tsdoc` option of
 * `@sanity/tsdown-config`, and by `@sanity/pkg-utils`'s `pkg check`.
 * @public
 */
export async function checkTsdoc(options: CheckTsdocOptions): Promise<CheckTsdocResult> {
  const {
    cwd,
    entryDtsFiles,
    bundledPackages,
    customTags = [],
    rules = {},
    logger,
    outDir: outDirOption,
  } = options

  const tsconfigPath = path.resolve(cwd, options.tsconfig || 'tsconfig.json')
  const tsconfig = loadTSConfig({cwd, tsconfigPath})
  // api-extractor needs a `compilerOptions.outDir` for its path mapping; tsdown does not, so
  // fall back to the configured outDir / dist folder when the tsconfig leaves it unset
  const outDir =
    tsconfig?.options.outDir ??
    (outDirOption ? path.resolve(cwd, outDirOption) : undefined) ??
    commonParentDir(entryDtsFiles) ??
    path.resolve(cwd, 'dist')

  const tsdocConfigFile = await createTSDocConfig({customTags})
  const messagesConfig = getExtractMessagesConfig({rules})
  const allMessages: ExtractorMessage[] = []

  for (const exportPath of entryDtsFiles) {
    if (!existsSync(exportPath)) continue

    const relativeDtsPath = path.relative(outDir, exportPath)
    const extractorConfig = ExtractorConfig.prepare({
      configObject: createApiExtractorConfig({
        bundledPackages,
        distPath: outDir,
        exportPath,
        filePath: relativeDtsPath,
        messages: messagesConfig,
        projectFolder: cwd,
        mainEntryPointFilePath: exportPath,
        tsconfig: tsconfig ?? {options: {}},
        tsconfigPath,
      }),
      configObjectFullPath: undefined,
      tsdocConfigFile,
      packageJsonFullPath: path.resolve(cwd, 'package.json'),
    })

    Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true,
      messageCallback(message: ExtractorMessage) {
        allMessages.push(message)
        message.handled = true
      },
    })
  }

  const warnings = allMessages.filter((msg) => msg.logLevel === ExtractorLogLevel.Warning)
  const errors = allMessages.filter((msg) => msg.logLevel === ExtractorLogLevel.Error)

  if (logger) {
    reportMessages(cwd, logger, warnings, errors)
  }

  if (errors.length) {
    throw new Error(
      `TSDoc/release-tag check failed with ${errors.length} error${errors.length === 1 ? '' : 's'}`,
    )
  }

  return {
    messages: allMessages,
    errorCount: errors.length,
    warningCount: warnings.length,
  }
}

function loadTSConfig(options: {
  cwd: string
  tsconfigPath: string
}): ReturnType<typeof ts.parseJsonConfigFileContent> | undefined {
  const {cwd, tsconfigPath} = options
  // Resolve a relative name from `cwd` (e.g. `tsconfig.dist.json`); an absolute path is kept.
  let configPath: string | undefined
  if (path.isAbsolute(tsconfigPath)) {
    configPath = tsconfigPath
  } else {
    // oxlint-disable-next-line unbound-method
    configPath = ts.findConfigFile(cwd, ts.sys.fileExists, tsconfigPath)
  }
  if (!configPath || !existsSync(configPath)) return undefined
  // oxlint-disable-next-line unbound-method
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  // Relative `extends`/`include`/`paths` are resolved from the tsconfig's directory, not `cwd`
  return ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath))
}

function commonParentDir(files: string[]): string | undefined {
  if (files.length === 0) return undefined
  let dir = path.dirname(files[0]!)
  for (const file of files.slice(1)) {
    while (dir !== path.dirname(dir) && !file.startsWith(dir + path.sep) && file !== dir) {
      dir = path.dirname(dir)
    }
  }
  return dir
}

function reportMessages(
  cwd: string,
  logger: CheckTsdocLogger,
  warnings: ExtractorMessage[],
  errors: ExtractorMessage[],
): void {
  if (warnings.length) {
    logger.log()
  }

  for (const msg of warnings) {
    if (msg.messageId === 'TS6307') {
      // Ignore this warning:
      // > TS6307: <filename> is not in project file list.
      // > Projects must list all files or use an 'include' pattern.
      continue
    }
    const sourceFilePath = msg.sourceFilePath && path.relative(cwd, msg.sourceFilePath)
    logger.warn(
      `${sourceFilePath || '?'}:${msg.sourceFileLine}:${msg.sourceFileColumn} - warning ${msg.messageId}\n${msg.text}\n`,
    )
  }

  if (!warnings.length && errors.length) {
    logger.log()
  }

  for (const msg of errors) {
    const sourceFilePath = msg.sourceFilePath && path.relative(cwd, msg.sourceFilePath)
    logger.error(
      `${sourceFilePath || '?'}:${msg.sourceFileLine}:${msg.sourceFileColumn} - error ${msg.messageId}\n${msg.text}\n`,
    )
  }
}
