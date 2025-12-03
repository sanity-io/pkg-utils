import path from 'node:path'
import {up as findPkgPath} from 'empathic/package'
import {rimraf} from 'rimraf'
import {loadConfig} from './core/config/loadConfig.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {createLogger} from './logger.ts'
import {resolveBuildContext} from './resolveBuildContext.ts'
import {resolveBuildTasks} from './resolveBuildTasks.ts'
import {createSpinner} from './spinner.ts'
import {buildTaskHandlers} from './tasks/index.ts'
import {type BuildTask, type TaskHandler} from './tasks/types.ts'

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
  quiet?: boolean
}): Promise<void> {
  const {
    cwd,
    emitDeclarationOnly,
    strict = false,
    tsconfig: tsconfigOption,
    clean = false,
    quiet = false,
  } = options
  const logger = createLogger(quiet)

  const pkgPath = findPkgPath({cwd})
  if (!pkgPath) {
    throw new Error('no package.json found', {cause: {cwd}})
  }
  const config = await loadConfig({cwd, pkgPath})

  const {parseStrictOptions} = await import('./strict.ts')
  const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
  const pkg = await loadPkgWithReporting({pkgPath, logger, strict, strictOptions})

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
    if (!quiet) {
      logger.log(
        `Deleting the \`dist\` folder: './${path.relative(cwd, ctx.distPath)}' before building...`,
      )
    }
    await rimraf(ctx.distPath)
  }

  const buildTasks = resolveBuildTasks(ctx)

  for (const task of buildTasks) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- TypeScript can't infer the correct handler type from discriminated union
    const handler = buildTaskHandlers[task.type] as TaskHandler<BuildTask>
    const taskName = handler.name(ctx, task)

    const spinner = createSpinner(taskName, quiet)

    try {
      const result = await handler.exec(ctx, task).toPromise()

      spinner.complete()
      ctx.logger.log()

      handler.complete(ctx, task, result)
    } catch (err) {
      spinner.error()

      if (err instanceof Error) {
        const RE_CWD = new RegExp(cwd, 'g')

        ctx.logger.error(err.message.replace(RE_CWD, '.'))
        ctx.logger.log()
      }

      handler.error(ctx, task, err)

      process.exit(1)
    }
  }
}
