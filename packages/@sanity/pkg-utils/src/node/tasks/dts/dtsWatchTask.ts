import path from 'node:path'
import type {ExtractorMessage} from '@microsoft/api-extractor'
import type ts from '@typescript/typescript6'
import chalk from 'chalk'
import * as rimraf from 'rimraf'
import {Observable} from 'rxjs'
import {getCompilerApi} from '../../core/ts/compilerApi.ts'
import {printExtractMessages} from '../../printExtractMessages.ts'
import type {TaskHandler} from '../types.ts'
import {buildTypes} from './buildTypes.ts'
import {DtsError} from './DtsError.ts'
import {extractTypes} from './extractTypes.ts'
import type {DtsResult, DtsWatchTask} from './types.ts'

/** @internal */
export const dtsWatchTask: TaskHandler<DtsWatchTask, DtsResult> = {
  name: (_ctx, task) =>
    [
      'build type definitions',
      ...task.entries.map((entry) => {
        return entry.targetPaths.map((targetPath) => {
          return [
            `    - ${chalk.cyan(entry.importId)}: `,
            `${chalk.yellow(entry.sourcePath)} ${chalk.gray('→')} ${chalk.yellow(targetPath)}`,
          ].join('')
        })
      }),
    ].join('\n'),
  exec: (ctx, task) => {
    const {config, cwd, files, logger, strict, ts: tsContext, bundledPackages} = ctx

    return new Observable((observer) => {
      const {config: tsConfig, configPath: tsConfigPath} = tsContext

      if (!tsConfig || !tsConfigPath) {
        observer.next({type: 'dts', messages: [], results: []})
        observer.complete()

        return () => {}
      }

      const {outDir, rootDir = cwd} = tsConfig.options

      if (!outDir) {
        observer.error(new Error('tsconfig.json is missing `compilerOptions.outDir`'))

        return () => {}
      }

      const tmpPath = path.resolve(outDir, '__tmp__')

      buildTypes({
        cwd,
        logger,
        outDir: tmpPath,
        tsconfig: tsConfig,
        strict,
        checkTypes: config?.extract?.checkTypes,
      }).catch((err) => {
        observer.error(err)
      })

      let watchProgram:
        ts.WatchOfConfigFile<ts.EmitAndSemanticDiagnosticsBuilderProgram> | undefined
      let closed = false

      const startWatchProgram = async () => {
        const tsApi = await getCompilerApi()

        if (closed) {
          return
        }

        const host = tsApi.createWatchCompilerHost(
          tsConfigPath,
          {
            ...tsConfig.options,
            declaration: true,
            declarationDir: tmpPath,
            emitDeclarationOnly: true,
            noEmit: false,
            noEmitOnError: strict ? true : (tsConfig.options.noEmitOnError ?? true),
            noCheck:
              config?.extract?.checkTypes === false
                ? true
                : (tsConfig.options.noCheck ?? tsConfig.options.isolatedDeclarations),
            outDir: tmpPath,
          },
          tsApi.sys,
          tsApi.createEmitAndSemanticDiagnosticsBuilderProgram,
          (diagnostic) => {
            logger.error(tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
          },
          (diagnostic) => {
            logger.info(tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
          },
        )

        // oxlint-disable-next-line unbound-method
        const origPostProgramCreate = host.afterProgramCreate

        host.afterProgramCreate = async (program) => {
          origPostProgramCreate?.(program)

          const messages: ExtractorMessage[] = []
          const results: {sourcePath: string; filePaths: string[]}[] = []

          for (const entry of task.entries) {
            const exportPath = entry.exportPath === '.' ? './index' : entry.exportPath

            const sourceTypesPath = path.resolve(
              tmpPath,
              path.relative(rootDir, path.resolve(cwd, entry.sourcePath)).replace(/\.ts$/, '.d.ts'),
            )

            const targetPaths = entry.targetPaths.map((targetPath) => path.resolve(cwd, targetPath))
            const filePaths = targetPaths.map((targetPath) => path.relative(outDir, targetPath))

            try {
              const result = await extractTypes({
                bundledPackages: bundledPackages || [],
                customTags: config?.extract?.customTags,
                cwd,
                distPath: outDir,
                exportPath,
                files,
                filePaths,
                projectPath: cwd,
                rules: config?.extract?.rules,
                sourceTypesPath: sourceTypesPath,
                tsconfig: tsConfig,
                tmpPath,
                tsconfigPath: path.resolve(cwd, tsConfigPath),
                extractorDisabled: config?.extract?.enabled === false,
              })

              messages.push(...result.messages)
              results.push({
                sourcePath: path.resolve(cwd, entry.sourcePath),
                filePaths: targetPaths,
              })
            } catch (err) {
              if (err instanceof DtsError) {
                messages.push(...err.messages)
              } else {
                observer.error(err)

                return
              }
            }
          }

          observer.next({type: 'dts', messages, results})
        }

        watchProgram = tsApi.createWatchProgram(host)
      }

      startWatchProgram().catch((err) => {
        observer.error(err)
      })

      return () => {
        closed = true
        watchProgram?.close()
        rimraf.sync(tmpPath)
      }
    })
  },
  complete: (ctx, task, result) => {
    const {logger} = ctx

    printExtractMessages(ctx, result.messages)

    logger.success(
      `build type definitions\n       ${task.entries
        .map(
          (entry) =>
            `    - ${chalk.cyan(entry.importId)}: ${chalk.yellow(entry.sourcePath)} ${chalk.gray('→')} ${chalk.yellow(entry.targetPaths.join(', '))}`,
        )
        .join('\n       ')}`,
    )
    logger.log('')
  },
  error: (ctx, _task, err) => {
    const {logger} = ctx

    if (err instanceof DtsError) {
      printExtractMessages(ctx, err.messages)
    } else if (err instanceof Error) {
      logger.error(err)
    }
  },
}
