import path from 'node:path'

import type {ExtractorMessage} from '@microsoft/api-extractor'
import chalk from 'chalk'
import rimraf from 'rimraf'
import {Observable} from 'rxjs'
import ts from 'typescript'

import {printExtractMessages} from '../../printExtractMessages'
import type {TaskHandler} from '../types'
import {buildTypes} from './buildTypes'
import {DtsError} from './DtsError'
import {extractTypes} from './extractTypes'
import type {DtsResult, DtsWatchTask} from './types'

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
      if (!tsContext.config || !tsContext.configPath) {
        observer.next({type: 'dts', messages: [], results: []})
        observer.complete()

        return
      }

      const {outDir, rootDir = cwd} = tsContext.config.options

      if (!outDir) {
        observer.error(new Error('tsconfig.json is missing `compilerOptions.outDir`'))

        return
      }

      const tmpPath = path.resolve(outDir, '__tmp__')

      buildTypes({
        cwd,
        logger,
        outDir: tmpPath,
        tsconfig: tsContext.config,
        strict,
      }).catch((err) => {
        observer.error(err)
      })

      const host = ts.createWatchCompilerHost(
        tsContext.configPath,
        {
          ...tsContext.config.options,
          declaration: true,
          declarationDir: tmpPath,
          emitDeclarationOnly: true,
          noEmit: false,
          noEmitOnError: strict ? true : (tsContext.config.options.noEmitOnError ?? true),
          outDir: tmpPath,
        },
        ts.sys,
        ts.createEmitAndSemanticDiagnosticsBuilderProgram,
        (diagnostic) => {
          logger.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        },
        (diagnostic) => {
          logger.info(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        },
      )

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
              tsconfig: tsContext.config!,
              tmpPath,
              tsconfigPath: path.resolve(cwd, tsContext.configPath || 'tsconfig.json'),
            })

            messages.push(...result.messages)
            results.push({sourcePath: path.resolve(cwd, entry.sourcePath), filePaths: targetPaths})
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

      const watchProgram = ts.createWatchProgram(host)

      return () => {
        watchProgram.close()
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
