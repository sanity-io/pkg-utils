import {getPkgExtMap, loadConfig, loadPkgWithReporting} from './core'
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
}): Promise<void> {
  const {cwd, emitDeclarationOnly, strict = false, tsconfig: tsconfigOption} = options
  const logger = createLogger()

  const pkg = await loadPkgWithReporting({cwd, logger, strict})

  const config = await loadConfig({cwd})
  const extMap = getPkgExtMap({legacyExports: config?.legacyExports ?? false})
  const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

  const ctx = await resolveBuildContext({
    config,
    cwd,
    emitDeclarationOnly,
    extMap,
    logger,
    pkg,
    strict,
    tsconfig,
  })

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
