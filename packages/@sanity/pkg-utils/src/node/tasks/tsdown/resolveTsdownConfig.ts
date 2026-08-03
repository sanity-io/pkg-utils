import path from 'node:path'
import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig, type InlineConfig, type UserConfig} from 'tsdown'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import {pkgExtMap} from '../../core/pkg/pkgExt.ts'
import {createExportsComposer} from './composeExports.ts'
import type {TsdownBuild} from './resolveTsdownBuilds.ts'

const RE_TS_SOURCE = /\.[cm]?tsx?$/

/**
 * Composes the tsdown config for one build of the waterfall: `@sanity/tsdown-config`'s
 * `defineConfig()` provides the shared Sanity base, and the pkg-utils opinions (browserslist
 * targets, `PKG_*` defines, exports reconciliation, dts selection) layer over it with
 * tsdown's `mergeConfig`.
 *
 * pkg-utils owns its own experience: the returned config carries `config: false`, so tsdown
 * never loads `tsdown.config.*` files — `package.config.ts` is the sole config source — and
 * `logLevel: 'warn'` keeps tsdown's info chatter out of pkg-utils' own output.
 * @internal
 */
export async function resolveTsdownConfig(
  ctx: BuildContext,
  build: TsdownBuild,
  options: {
    /** Only the first build of the waterfall cleans, so later builds can't wipe earlier output. */
    clean: boolean
    watch?: boolean
  },
): Promise<InlineConfig> {
  const {config, cwd, distPath, pkg} = ctx

  const reactCompiler = config?.reactCompiler
  if (typeof reactCompiler === 'object' && reactCompiler.reactServer === true) {
    throw new Error(
      [
        'package.config.ts: `reactCompiler.reactServer` is not supported by `pkg build` — the',
        'dual React Server Components build needs one tsdown run driving multiple configs.',
        'Use `tsdown` + `@sanity/tsdown-config` directly instead: export the config from',
        '`tsdown.config.ts` and build with `tsdown`.',
      ].join('\n'),
    )
  }

  const entry: Record<string, string> = {}
  for (const buildEntry of build.entries) {
    entry[buildEntry.alias] = buildEntry.source
  }

  // tsdown's `format` applies to the whole build (and its exports generation composes the
  // dual `import`/`require` map from both formats' chunks of one build), so the entries'
  // formats union: every entry is emitted in every format of the build. Mixed per-entry
  // coverage gets a heads-up — the extra files are emitted, and local exports generation
  // will declare them.
  const formats = new Set(build.entries.flatMap((buildEntry) => buildEntry.formats))
  if (formats.size > 1) {
    const partial = build.entries.filter((buildEntry) => buildEntry.formats.length < formats.size)
    if (partial.length) {
      const names = partial
        .map((buildEntry) =>
          buildEntry.exportPath ? `exports["${buildEntry.exportPath}"]` : buildEntry.source,
        )
        .join(', ')
      ctx.logger.warn(
        `${names} declare${partial.length === 1 ? 's' : ''} fewer formats than the rest of the package. tsdown emits every format of a build for every entry, so the missing format is built anyway (and local exports generation will declare it). Declare both \`import\` and \`require\` targets for every subpath — or for none — to keep the exports map unambiguous.`,
      )
    }
  }
  const format = [
    ...(formats.has('esm') ? ['esm' as const] : []),
    ...(formats.has('commonjs') ? ['cjs' as const] : []),
  ]

  const platform =
    build.runtime === 'node' ? 'node' : build.runtime === 'browser' ? 'browser' : 'neutral'

  // Build-time constants: `PKG_RUNTIME` is per build (the whole point of the variant builds),
  // `PKG_VERSION` reads the environment override first, like v11. pkg-utils' own build skips
  // them so the replacement logic in this very file survives its own bundling.
  const define: Record<string, string> = {}
  if (pkg.name !== '@sanity/pkg-utils') {
    define['process.env.PKG_RUNTIME'] = JSON.stringify(build.runtime)
    define['process.env.PKG_VERSION'] = JSON.stringify(process.env['PKG_VERSION'] || pkg.version)
  }
  for (const [key, value] of Object.entries(config?.define || {})) {
    define[key] = JSON.stringify(value)
  }

  // Types are generated with tsdown (rolldown-plugin-dts). `@typescript/native-preview` in
  // devDependencies auto-enables tsgo, like v11; an explicit `dts.tsgo` wins.
  const hasTsSources = build.entries.some((buildEntry) => RE_TS_SOURCE.test(buildEntry.source))
  const dts =
    hasTsSources && config?.dts !== false
      ? {
          ...(typeof pkg.devDependencies === 'object' &&
          '@typescript/native-preview' in pkg.devDependencies
            ? {tsgo: true}
            : {}),
          // Always create dts from scratch, don't reuse contexts from previous builds
          newContext: true,
          ...(config?.dts === undefined ? {} : config.dts),
          ...(ctx.emitDeclarationOnly ? {emitDtsOnly: true} : {}),
        }
      : false

  // Exports generation runs on the canonical build only, with `devExports: 'source'` — the
  // hand-written Sanity convention (`source` conditions in `exports`, a `source`-less
  // `publishConfig.exports`) — and the pkg-utils composer reconciling the generated map with
  // the hand-written one. tsdown's own `enabled: 'local-only'` default applies: the map is
  // written during local builds and left alone in CI. A types-only build never rewrites
  // `package.json`, and neither do watch builds (a rewrite would re-trigger the
  // `package.json` watcher).
  const exports: UserConfig['exports'] =
    build.canonical && !ctx.emitDeclarationOnly && !options.watch
      ? {
          devExports: 'source',
          customExports: createExportsComposer(ctx, build),
          // Keep the hand-written legacy fields (`main`/`module`) in sync instead of deleting
          // them; packages without them don't gain them
          ...(pkg.main || pkg.module ? {legacy: true} : {}),
        }
      : false

  const base = await defineConfig({
    cwd,
    tsconfig: ctx.ts.configPath,
    platform,
    format,
    entry,
    // POSIX separators: on Windows `path.relative` yields backslashes, which would leak into
    // generated `package.json` export targets (e.g. the conditional vanilla-extract export)
    outDir: path.relative(cwd, distPath).replaceAll('\\', '/') || '.',
    target: ctx.target[build.runtime],
    define,
    sourcemap: config?.sourcemap,
    // tsdown owns cleaning: the first build of the waterfall carries the effective `clean`
    // (the config passthrough, or tsdown's default `true`), every later build gets `false`.
    // A types-only build never cleans, so it can't delete JS output.
    clean: options.clean && !ctx.emitDeclarationOnly ? config?.clean : false,
    dts,
    deps: ctx.deps,
    exports,
    reactCompiler: config?.reactCompiler,
    styledComponents: config?.styledComponents,
    vanillaExtract: config?.vanillaExtract,
  })

  // The hand-written exports define the emitted extensions (`.js`/`.mjs`/`.cjs` per
  // `package.json#type`, enforced by `validateExports`), so the extensions are pinned
  // explicitly instead of relying on tsdown's defaults (whose `fixedExtension` kicks in for
  // `platform: 'node'` and would emit `.mjs` for `type: module` packages).
  const extMap = pkgExtMap[pkg.type === 'module' ? 'module' : 'commonjs']
  const outExtensions: UserConfig['outExtensions'] = ({format: outputFormat}) => ({
    js: outputFormat === 'cjs' ? extMap.commonjs : extMap.esm,
  })

  const merged = mergeConfig(base, {
    outExtensions,
    // publint runs during `pkg check` (via its node API), not inside the build
    publint: false,
    // the per-file size report logs through tsdown's info channel; pkg-utils prints its own
    report: false,
    ...(config?.minify === true ? {minify: true} : {}),
    ...(config?.plugins === undefined ? {} : {plugins: config.plugins}),
  })

  return {
    ...merged,
    config: false,
    logLevel: 'warn',
    ...(options.watch ? {watch: true} : {}),
  }
}
