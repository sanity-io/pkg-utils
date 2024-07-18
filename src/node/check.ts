import path from 'node:path'

import esbuild, {type BuildFailure, type Message} from 'esbuild'

import {createConsoleSpy} from './consoleSpy'
import {loadConfig, loadPkgWithReporting} from './core'
import {fileExists} from './fileExists'
import {createLogger, type Logger} from './logger'
import {printPackageTree} from './printPackageTree'
import {resolveBuildContext} from './resolveBuildContext'

/** @public */
export async function check(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption} = options
  const logger = createLogger()

  const config = await loadConfig({cwd})
  const legacyExports = config?.legacyExports ?? false
  const pkg = await loadPkgWithReporting({cwd, logger, strict, legacyExports})
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

    if (exportPaths.import.length) {
      checkExports(exportPaths.import, {cwd, external, format: 'esm', logger})
    }

    if (exportPaths.require.length) {
      checkExports(exportPaths.require, {cwd, external, format: 'cjs', logger})
    }

    consoleSpy.restore()
  }
}

async function checkExports(
  exportPaths: string[],
  options: {cwd: string; external: string[]; format: 'esm' | 'cjs'; logger: Logger},
) {
  const {cwd, external, format, logger} = options

  const code = exportPaths
    .map((id) => (format ? `import('${id}');` : `require('${id}');`))
    .join('\n')

  try {
    const esbuildResult = await esbuild.build({
      bundle: true,
      external,
      format,
      logLevel: 'silent',
      // otherwise output maps to stdout as we're using stdin
      outfile: '/dev/null',
      platform: 'node',
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
      !(msg.detail || msg.text).includes(`does not affect esbuild's own target setting`)
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
      logger.error(`${err}`)

      logger.log()
    }

    process.exit(1)
  }
}

function printEsbuildMessage(log: (...args: unknown[]) => void, msg: esbuild.Message) {
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
