import path from 'node:path'

import rimraf from 'rimraf'

import {loadConfig, loadPkgWithReporting} from './core'
import {createLogger} from './logger'
import {resolveBuildContext} from './resolveBuildContext'
import {resolveBuildTasks} from './resolveBuildTasks'
import {createSpinner} from './spinner'
import {type BuildTask, buildTaskHandlers, type TaskHandler} from './tasks'

/**
 * Build the distribution files of a npm package.
 *
 * @example
 * ```ts
 * import {build} from '@sanity/pkg-utils'
 *
 * build({
 *   cwd: process.cwd(),
 *   tsconfig: 'tsconfig.dist.json,
 * }).then(() => {
 *   console.log('successfully built')
 * }).catch((err) => {
 *   console.log(`build error: ${err.message}`)
 * })
 * ```
 *
 * @public
 */
export async function build(options: {
  cwd: string
  emitDeclarationOnly?: boolean
  strict?: boolean
  tsconfig?: string
  clean?: boolean
}): Promise<void> {
  const {
    cwd,
    emitDeclarationOnly,
    strict = false,
    tsconfig: tsconfigOption,
    clean = false,
  } = options
  const logger = createLogger()

  const config = await loadConfig({cwd})

  const legacyExports = config?.legacyExports ?? false
  const pkg = await loadPkgWithReporting({cwd, logger, strict, legacyExports})

  const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

  const ctx = await resolveBuildContext({
    config,
    cwd,
    emitDeclarationOnly,
    logger,
    pkg,
    strict,
    tsconfig,
  })

  if (clean) {
    logger.log(
      `Deleting the \`dist\` folder: './${path.relative(cwd, ctx.distPath)}' before building...`,
    )
    await rimraf(ctx.distPath)
  }

  const buildTasks = resolveBuildTasks(ctx)

  for (const task of buildTasks) {
    const handler = buildTaskHandlers[task.type] as TaskHandler<BuildTask>
    const taskName = handler.name(ctx, task)

    const spinner = createSpinner(taskName)

    try {
      const result = await handler.exec(ctx, task).toPromise()

      spinner.complete()
      ctx.logger.log()

      handler.complete(ctx, task, result)
    } catch (err) {
      spinner.error()

      if (err instanceof Error) {
        const RE_CWD = new RegExp(`${cwd}`, 'g')

        ctx.logger.error(err.message.replace(RE_CWD, '.'))
        ctx.logger.log()
      }

      handler.error(ctx, task, err)

      process.exit(1)
    }
  }
}
