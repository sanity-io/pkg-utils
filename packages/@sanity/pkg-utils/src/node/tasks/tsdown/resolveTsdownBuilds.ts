import path from 'node:path'
import type {PkgFormat, PkgRuntime} from '../../core/config/types.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import {fileEnding} from '../../core/pkg/pkgExt.ts'

/**
 * One entry of a tsdown build.
 * @internal
 */
export interface TsdownBuildEntry {
  /**
   * The entry alias handed to tsdown: the output path relative to `dist` without the
   * extension (e.g. `index`, `index.browser`, `sub/feature`), so the emitted filenames match
   * the hand-written `exports` targets exactly.
   */
  alias: string
  source: string
  /** The hand-written export subpath this entry backs (`undefined` for `bundles`). */
  exportPath?: string
  /** The formats the hand-written exports declare for this entry. */
  formats: PkgFormat[]
}

/**
 * One tsdown `build()` call of the waterfall. Builds run serially — variants and bundles
 * first, the canonical build last, so its exports generation and publint see every emitted
 * file on disk.
 * @internal
 */
export interface TsdownBuild {
  /** Stable identifier, e.g. `neutral`, `browser`, `node`, `bundles`. */
  key: string
  runtime: PkgRuntime
  /** The canonical build owns `dist` conventions: exports generation runs here. */
  canonical: boolean
  entries: TsdownBuildEntry[]
}

/**
 * Collapses the hand-written `exports` map (+ `bundles`) into the per-platform tsdown build
 * waterfall: one canonical build for the package's default runtime, plus a variant build per
 * `browser`/`node` exports condition, plus builds for `bundles` (which must not participate
 * in exports generation).
 * @internal
 */
export function resolveTsdownBuilds(ctx: BuildContext): TsdownBuild[] {
  const {config, cwd, distPath, logger} = ctx

  const entryAlias = (output: string): string => {
    const alias = path
      .relative(distPath, path.resolve(cwd, output))
      .replaceAll('\\', '/')
      .replace(fileEnding, '')
    if (alias.startsWith('..')) {
      throw new Error(`output file is outside the \`dist\` folder: ${output}`)
    }
    return alias
  }

  interface EntryDraft {
    alias: string
    source: string
    exportPath?: string | undefined
    formats: Set<PkgFormat>
  }

  const draftsByBuild = new Map<string, Map<string, EntryDraft>>()

  const addEntry = (
    buildKey: string,
    entry: {
      source: string
      exportPath?: string | undefined
      import?: string | undefined
      require?: string | undefined
    },
  ) => {
    const {source, exportPath} = entry
    const aliases = new Set<string>()
    const formats = new Set<PkgFormat>()
    if (entry.import) {
      aliases.add(entryAlias(entry.import))
      formats.add('esm')
    }
    if (entry.require) {
      aliases.add(entryAlias(entry.require))
      formats.add('commonjs')
    }
    if (aliases.size === 0) return
    if (aliases.size > 1) {
      throw new Error(
        `the \`import\` and \`require\` targets of ${
          exportPath ? `exports["${exportPath}"]` : `the bundle for ${source}`
        } must share a basename (e.g. \`./dist/index.js\` + \`./dist/index.cjs\`), ` +
          `got: ${entry.import} and ${entry.require}`,
      )
    }
    const [alias] = aliases
    let drafts = draftsByBuild.get(buildKey)
    if (!drafts) {
      drafts = new Map()
      draftsByBuild.set(buildKey, drafts)
    }
    const existing = drafts.get(alias!)
    if (existing) {
      if (existing.source !== source) {
        throw new Error(
          `conflicting sources for the output alias "${alias}": ${existing.source} and ${source}`,
        )
      }
      for (const format of formats) existing.formats.add(format)
      return
    }
    drafts.set(alias!, {alias: alias!, source, exportPath, formats})
  }

  const exports = Object.entries(ctx.exports || {})

  let hasRuntimeConditions = false

  for (const [exportPath, exp] of exports) {
    addEntry('canonical', {
      source: exp.source,
      exportPath,
      import: exp.import,
      require: exp.require,
    })

    if (exp.browser?.import || exp.browser?.require) {
      hasRuntimeConditions = true
      addEntry('browser', {
        source: exp.browser.source || exp.source,
        exportPath,
        import: exp.browser.import,
        require: exp.browser.require,
      })
    }

    if (exp.node?.import || exp.node?.require) {
      hasRuntimeConditions = true
      addEntry('node', {
        source: exp.node.source || exp.source,
        exportPath,
        import: exp.node.import,
        require: exp.node.require,
      })
    }
  }

  // `bundles` are extra entrypoints that are deliberately not in the exports map (CLI workers
  // and similar), so they build separately from the canonical build — exports generation
  // derives subpaths from every entry of its build, and bundles must never become export
  // subpaths of their own.
  for (const bundle of config?.bundles || []) {
    const runtime = bundle.runtime || ctx.runtime
    addEntry(runtime === ctx.runtime ? 'bundles' : `bundles:${runtime}`, {
      source: bundle.source,
      import: bundle.import,
      require: bundle.require,
    })
  }

  if (hasRuntimeConditions) {
    logger.warn(
      [
        'The `exports[].browser.source` / `exports[].node.source` pattern is not recommended: every',
        'runtime condition adds a full extra build (complexity and build time). Consider instead:',
        '  1. separate npm packages per platform/runtime, selected through export conditions that',
        '     pick the right package per environment,',
        '  2. when possible, a single neutral build using JS that works in both runtimes without',
        '     special-casing (e.g. `new URL` over `require("url")`, WebCrypto over',
        '     `require("crypto")`), or',
        '  3. using `tsdown` + `@sanity/tsdown-config` directly, exporting an array from',
        '     `tsdown.config.ts` with one config per `platform` — the fully supported path for',
        '     this level of customization.',
      ].join('\n'),
    )
  }

  const builds: TsdownBuild[] = []

  const toBuild = (key: string, runtime: PkgRuntime, canonical: boolean): TsdownBuild | null => {
    const drafts = draftsByBuild.get(key)
    if (!drafts || drafts.size === 0) return null
    return {
      key,
      runtime,
      canonical,
      entries: Array.from(drafts.values(), (draft) => ({
        alias: draft.alias,
        source: draft.source,
        ...(draft.exportPath === undefined ? {} : {exportPath: draft.exportPath}),
        formats: Array.from(draft.formats),
      })),
    }
  }

  // Variants and bundles run first; the canonical build runs last so its exports generation
  // and publint see the other builds' files on disk.
  for (const key of draftsByBuild.keys()) {
    if (key === 'canonical') continue
    const bundleRuntime = key.startsWith('bundles:') ? key.slice('bundles:'.length) : undefined
    const runtime: PkgRuntime =
      key === 'browser' || bundleRuntime === 'browser'
        ? 'browser'
        : key === 'node' || bundleRuntime === 'node'
          ? 'node'
          : ctx.runtime
    const build = toBuild(key, runtime, false)
    if (build) builds.push(build)
  }

  const canonical = toBuild('canonical', ctx.runtime, true)
  if (canonical) builds.push(canonical)

  return builds
}
