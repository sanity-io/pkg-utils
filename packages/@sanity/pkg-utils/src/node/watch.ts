import {up as findPkgPath} from 'empathic/package'
import type {Subscription} from 'rxjs'
import {switchMap} from 'rxjs'
import {build as tsdownBuild, type TsdownBundle} from 'tsdown'
import {loadConfig} from './core/config/loadConfig.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {createLogger} from './logger.ts'
import {resolveBuildContext} from './resolveBuildContext.ts'
import {resolveTsdownBuilds} from './tasks/tsdown/resolveTsdownBuilds.ts'
import {resolveTsdownConfig} from './tasks/tsdown/resolveTsdownConfig.ts'

const asyncDispose: typeof Symbol.asyncDispose =
  Symbol.asyncDispose || Symbol.for('Symbol.asyncDispose')

/** @public */
export async function watch(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
  signal?: AbortSignal
}): Promise<void> {
  const {cwd, strict = false, tsconfig: tsconfigOption, signal} = options

  const logger = createLogger()

  const {watchConfigFiles} = await import('./watchConfigFiles.ts')
  const configFiles$ = await watchConfigFiles({cwd, logger})

  // Every rebuild of the waterfall holds tsdown watchers (one per platform build); they are
  // disposed when the config files change (the waterfall restarts) or the signal aborts.
  let bundles: TsdownBundle[] = []
  const disposeBundles = async () => {
    const disposing = bundles
    bundles = []
    for (const bundle of disposing) {
      await bundle[asyncDispose]()
    }
  }

  const ctx$ = configFiles$.pipe(
    switchMap(async () => {
      const pkgPath = findPkgPath({cwd})
      if (!pkgPath) {
        throw new Error('missing package.json', {cause: {cwd}})
      }

      const config = await loadConfig({cwd, pkgPath})
      const {parseStrictOptions} = await import('./strict.ts')
      const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
      const pkg = await loadPkgWithReporting({pkgPath, logger, strict, strictOptions})
      const tsconfig = tsconfigOption || config?.tsconfig || 'tsconfig.json'

      return resolveBuildContext({config, cwd, logger, pkg, strict, tsconfig})
    }),
  )

  const ctxSubscription: Subscription = ctx$.subscribe(async (ctx) => {
    try {
      await disposeBundles()

      const builds = resolveTsdownBuilds(ctx)

      let first = true
      for (const buildDef of builds) {
        const inlineConfig = await resolveTsdownConfig(ctx, buildDef, {
          clean: first,
          watch: true,
        })
        first = false

        bundles.push(...(await tsdownBuild(inlineConfig)))
      }

      logger.success(`${ctx.pkg.name}: watching for file changes\u2026`)
      logger.log()
    } catch (err) {
      ctx.logger.error(err)
      ctx.logger.log()

      process.exit(1)
    }
  })

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        ctxSubscription.unsubscribe()
        void disposeBundles()
      },
      {once: true},
    )
  }
}
