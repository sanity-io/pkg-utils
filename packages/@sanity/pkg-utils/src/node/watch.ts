import {up as findPkgPath} from 'empathic/package'
import type {Subscription} from 'rxjs'
import {switchMap} from 'rxjs'
import {build as tsdownBuild, type TsdownBundle} from 'tsdown'
import {loadConfig} from './core/config/loadConfig.ts'
import {isRecord} from './core/isRecord.ts'
import {loadPkgWithReporting} from './core/pkg/loadPkgWithReporting.ts'
import {writeBundleCssExports} from './core/pkg/writeBundleCssExports.ts'
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
  // RxJS does not await async subscriber callbacks, so a monotonically increasing run id
  // guards the rebuilds: only the latest run may publish into `bundles`, and a run that turns
  // stale mid-flight (a newer config-file event, or the abort signal) disposes the watchers
  // it created instead of leaking them.
  let bundles: TsdownBundle[] = []
  let runId = 0
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
    const id = ++runId
    const runBundles: TsdownBundle[] = []
    try {
      await disposeBundles()

      // Full builds write the conditional `./<css>` export through tsdown's
      // `exports.customExports` composition, but watch mode disables tsdown's `exports` feature
      // (a package.json write per rebuild would loop the watcher). Keep the export in sync here
      // instead, once per context, like v11 — the write is idempotent, so it won't loop.
      const vanillaExtract = ctx.config?.vanillaExtract
      if (vanillaExtract) {
        const veOptions = vanillaExtract === true ? {} : vanillaExtract
        // `@sanity/tsdown-config` defaults `inject` to `{nodeCompat: true}` (the conditional
        // CSS export pattern); an explicit user `inject` replaces that default
        const inject = veOptions.inject ?? {nodeCompat: true}
        if (isRecord(inject) && inject['nodeCompat']) {
          await writeBundleCssExports({
            cwd,
            distPath: ctx.distPath,
            cssName: veOptions.fileName || 'bundle.css',
            logger,
          })
        }
      }

      const builds = resolveTsdownBuilds(ctx)

      let first = true
      for (const buildDef of builds) {
        if (id !== runId) break

        const inlineConfig = await resolveTsdownConfig(ctx, buildDef, {
          clean: first,
          watch: true,
        })
        first = false

        runBundles.push(...(await tsdownBuild(inlineConfig)))
      }

      if (id !== runId) {
        // A newer run (or the abort signal) took over while this rebuild was in flight —
        // dispose everything this run created instead of publishing it
        for (const bundle of runBundles) {
          await bundle[asyncDispose]()
        }
        return
      }

      bundles = runBundles

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
        runId++
        ctxSubscription.unsubscribe()
        void disposeBundles()
      },
      {once: true},
    )
  }
}
