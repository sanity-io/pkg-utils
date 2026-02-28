import path from 'node:path'
import chalk from 'chalk'
import {from} from 'rxjs'
import {createConsoleSpy} from '../../consoleSpy.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import type {RolldownDtsTask, TaskHandler} from '../types.ts'

/** @internal */
export const rolldownDtsTask: TaskHandler<RolldownDtsTask> = {
  name: (ctx, task) => {
    const bundleEntries = task.entries.filter((e) => e.path.includes('__$$bundle_'))
    const entries = task.entries.filter((e) => !e.path.includes('__$$bundle_'))

    const targetLines = task.target.length
      ? [`  target:`, ...task.target.map((t) => `    - ${chalk.yellow(t)}`)]
      : []

    const bundlesLines = bundleEntries.length
      ? [
          '  bundles:',
          ...bundleEntries.map((e) =>
            [
              `    - `,
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(replaceFileEnding(e.output))}`,
            ].join(''),
          ),
        ]
      : []

    const entriesLines = entries.length
      ? [
          '  entries:',
          ...entries.map((e) =>
            [
              `    - `,
              `${chalk.cyan(path.join(ctx.pkg.name, e.path))}: `,
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(replaceFileEnding(e.output))}`,
            ].join(''),
          ),
        ]
      : []

    return [
      `Build type definitions with ${chalk.bold('rolldown')}...`,
      `  format: ${chalk.yellow(task.format)}`,
      ...targetLines,
      ...bundlesLines,
      ...entriesLines,
    ].join('\n')
  },
  exec: (ctx, task) => {
    return from(execPromise(ctx, task))
  },
  complete: () => {
    //
  },
  error: (_ctx, _task, err) => {
    console.error(err)
  },
}

async function execPromise(ctx: BuildContext, task: RolldownDtsTask) {
  const [{rolldown}, {resolveRolldownConfig}] = await Promise.all([
    import('rolldown'),
    import('./resolveRolldownConfig.ts'),
  ])
  const {distPath, files, logger} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  // Prevent rolldown from printing directly to the console
  const consoleSpy = createConsoleSpy({
    onRestored: (messages) => {
      for (const msg of messages) {
        const text = String(msg.args[0])

        if (msg.code === 'CIRCULAR_DEPENDENCY') {
          continue // ignore
        }

        if (text.startsWith('Dynamic import can only')) {
          continue // ignore
        }

        if (text.startsWith('Sourcemap is likely to be incorrect')) {
          continue // ignore
        }

        if (msg.type === 'log') {
          logger.info(...msg.args)
        }

        if (msg.type === 'warn') {
          logger.warn(...msg.args)
        }

        if (msg.type === 'error') {
          logger.error(...msg.args)
        }
      }
    },
  })

  try {
    const {inputOptions, outputOptions} = resolveRolldownConfig(ctx, task)

    // Create bundle
    const bundle = await rolldown({
      ...inputOptions,
      onwarn(warning) {
        consoleSpy.messages.push({
          type: 'warn',
          code: warning.code,
          args: [warning.message],
        })
      },
    })

    // generate output specific code in-memory
    // you can call this function multiple times on the same bundle object
    const {output} = await bundle.generate(outputOptions)

    for (const chunkOrAsset of output) {
      if (chunkOrAsset.type === 'asset') {
        files.push({
          type: 'asset',
          path: path.resolve(outDir, chunkOrAsset.fileName),
        })
      } else {
        files.push({
          type: 'chunk',
          path: path.resolve(outDir, chunkOrAsset.fileName),
        })
      }
    }

    // or write the bundle to disk
    await bundle.write(outputOptions)

    // closes the bundle
    await bundle.close()

    // Restore console
    consoleSpy.restore()
  } catch (err) {
    // Restore console
    consoleSpy.restore()
    throw err
  }
}

function replaceFileEnding(filePath: string) {
  switch (true) {
    case filePath.endsWith('.mjs'):
      return filePath.replace(/\.mjs$/, '.d.mts')
    case filePath.endsWith('.cjs'):
      return filePath.replace(/\.cjs$/, '.d.cts')
    default:
      return filePath.replace(/\.js$/, '.d.ts')
  }
}
