import path from 'node:path'
import chalk from 'chalk'
import {from} from 'rxjs'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import type {TaskHandler, TsdownTask} from '../types.ts'
import {resolveTsdownConfig} from './resolveTsdownConfig.ts'

/** @internal */
export const tsdownTask: TaskHandler<TsdownTask> = {
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
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
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
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
            ].join(''),
          ),
        ]
      : []

    return [
      `Build with ${chalk.bold('tsdown')}...`,
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

async function execPromise(ctx: BuildContext, task: TsdownTask) {
  const {build} = await import('tsdown')
  const {distPath, files} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  const options = await resolveTsdownConfig(ctx, task)

  // Build with tsdown
  await build(options)

  // Track the output files
  // tsdown generates files based on the entry configuration
  for (const entry of task.entries) {
    const outputPath = path.resolve(outDir, entry.output)

    // Add JS file
    files.push({
      type: 'chunk',
      path: outputPath,
    })

    // Add DTS file (tsdown generates both JS and DTS)
    const dtsPath = outputPath
      .replace(/\.m?js$/, '.d.ts')
      .replace(/\.cjs$/, '.d.cts')
      .replace(/\.mjs$/, '.d.mts')
    files.push({
      type: 'types',
      path: dtsPath,
    })
  }
}
