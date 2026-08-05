import type {PkgExport} from '../../core/config/types.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import {isRecord} from '../../core/isRecord.ts'
import type {TsdownBuild} from './resolveTsdownBuilds.ts'

type ExportsMap = Record<string, unknown>
interface ComposeContext {
  isPublish: boolean
}

/**
 * The pkg-utils opinion layer over tsdown's generated `exports` map, composed into
 * `exports.customExports` of the canonical build (the same composition hook
 * `@sanity/vanilla-extract-tsdown-plugin` uses for its conditional CSS export).
 *
 * tsdown generates subpaths from the entry aliases with `source`/`import`/`require` conditions
 * (`devExports: 'source'`) and a `source`-less `publishConfig.exports` — already the Sanity
 * convention. This composer reconciles the generated map with the hand-written one, which
 * remains the input:
 *
 * - generated keys are remapped to the hand-written subpaths (entry aliases are derived from
 *   the output paths, which don't have to match the subpath names),
 * - the hand-written `types`, `browser`, `node`, `development` and `monorepo` conditions are
 *   re-inserted (tsdown's generator cannot express them; the `browser`/`node` files are built
 *   by the variant builds of the waterfall) — with `source`-like conditions stripped from the
 *   publish variant,
 * - all hand-written conditions (`react-server`, `worker`, … included) retain their authored
 *   order, because earlier matching conditions take precedence,
 * - a trailing `default` condition is kept on dual-format entries (tsdown emits bare
 *   `import`/`require` pairs; the Sanity convention always ends with `default`),
 * - hand-written subpaths that aren't build entries (`.css`/`.json` exports, `svelte`
 *   entries) are carried over untouched, and
 * - the hand-written subpath and condition key order is preserved.
 * @internal
 */
export function createExportsComposer(
  ctx: BuildContext,
  build: TsdownBuild,
): (exportsMap: ExportsMap, context: ComposeContext) => ExportsMap {
  const {pkg} = ctx
  const type = pkg.type === 'module' ? 'module' : 'commonjs'

  // alias -> hand-written subpath, e.g. `index` -> `.`, `sub/feature` -> `./feature`
  const aliasToExportPath = new Map<string, string>()
  for (const entry of build.entries) {
    if (entry.exportPath !== undefined) {
      aliasToExportPath.set(entry.alias, entry.exportPath)
    }
  }

  return (exportsMap, context) => {
    const {isPublish} = context

    // 1. Remap the generated keys (`.` for the `index` alias, `./<alias>` otherwise) back to
    //    the hand-written subpaths.
    const remapped: ExportsMap = {}
    for (const [key, value] of Object.entries(exportsMap)) {
      const alias = key === '.' ? 'index' : key.startsWith('./') ? key.slice(2) : key
      const exportPath = aliasToExportPath.get(alias) ?? key
      remapped[exportPath] = value
    }

    // 2. Reconcile each generated entry with its hand-written counterpart.
    const result: ExportsMap = {}
    const handwritten = ctx.exports || {}

    const reconcile = (exportPath: string, value: unknown): unknown => {
      const exp = handwritten[exportPath]
      if (!exp) return value
      return reconcileEntry(exp, value, {isPublish, type})
    }

    // 3. Follow the hand-written key order; append generated extras (e.g. `./package.json`
    //    when it wasn't hand-written) at the end.
    const handwrittenRaw: Record<string, unknown> = pkg.exports || {}
    for (const exportPath of Object.keys(handwrittenRaw)) {
      if (exportPath in remapped) {
        result[exportPath] = reconcile(exportPath, remapped[exportPath])
      } else {
        // Hand-written subpaths that aren't build entries (`.css`/`.json` exports, `svelte`
        // entries) pass through untouched.
        result[exportPath] = handwrittenRaw[exportPath]
      }
    }
    for (const [exportPath, value] of Object.entries(remapped)) {
      if (exportPath in result) continue
      result[exportPath] = reconcile(exportPath, value)
    }

    return result
  }
}

/**
 * Rebuilds a generated subpath entry in its authored condition order, re-inserting the
 * hand-written conditions tsdown's generator cannot express.
 */
function reconcileEntry(
  exp: PkgExport,
  generated: unknown,
  options: {isPublish: boolean; type: 'commonjs' | 'module'},
): unknown {
  const {isPublish, type} = options

  // tsdown's publish variant of a single-format entry is a plain string
  const gen: Record<string, unknown> | undefined =
    typeof generated === 'string'
      ? {default: generated}
      : isRecord(generated)
        ? generated
        : undefined
  if (!gen) return generated

  const browser =
    exp.browser && (exp.browser.import || exp.browser.require)
      ? pickConditions(exp.browser, isPublish)
      : undefined
  const node =
    exp.node && (exp.node.import || exp.node.require)
      ? pickConditions(exp.node, isPublish)
      : undefined
  const custom = pickCustomConditions(exp)

  // A plain-string publish entry without hand-written conditions to re-insert stays a plain
  // string (e.g. `publishConfig.exports["."] = "./dist/index.js"`)
  if (typeof generated === 'string' && !exp.types && !browser && !node && custom.length === 0) {
    return generated
  }

  const next: Record<string, unknown> = {}

  // `source`-like conditions resolve at development time and are stripped from the publish
  // variant (tsdown already does this for `source`; `development`/`monorepo` follow)
  if (!isPublish) {
    if (typeof gen['source'] === 'string') next['source'] = gen['source']
    else if (exp.source) next['source'] = exp.source
    if (exp.development) next['development'] = exp.development
    if (exp.monorepo) next['monorepo'] = exp.monorepo
  }

  if (exp.types) next['types'] = exp.types
  if (browser) next['browser'] = browser
  if (node) next['node'] = node

  // Hand-written custom conditions (`react-server`, `worker`, …) aren't built, but they are
  // the author's: carry their targets over, then restore every condition's authored position.
  for (const [condition, target] of custom) {
    next[condition] = target
  }

  if (typeof gen['import'] === 'string' && typeof gen['require'] === 'string') {
    next['import'] = gen['import']
    next['require'] = gen['require']
    // tsdown emits bare `import`/`require` pairs; the Sanity convention ends with `default`
    next['default'] = type === 'module' ? gen['import'] : gen['require']
  } else {
    // Single-format entries keep the generated shape (`{source, default}` in development)
    for (const [condition, target] of Object.entries(gen)) {
      if (condition in next || condition === 'source') continue
      next[condition] = target
    }
  }

  return preserveConditionOrder(next, exp)
}

/** The hand-written `browser`/`node` condition object, minus `source` for the publish map. */
function pickConditions(
  conditions: {source?: string; import?: string; require?: string},
  isPublish: boolean,
): Record<string, string> {
  const next: Record<string, string> = {}
  if (!isPublish && conditions.source) next['source'] = conditions.source
  if (conditions.import) next['import'] = conditions.import
  if (conditions.require) next['require'] = conditions.require
  return preserveConditionOrder(next, conditions)
}

/**
 * Reorders reconciled conditions to match their hand-written order. Conditions generated by
 * tsdown but absent from the hand-written entry stay at the end in their generated order.
 */
function preserveConditionOrder<T>(
  conditions: Record<string, T>,
  authored: object,
): Record<string, T> {
  const entries: [string, T][] = []
  const added = new Set<string>()

  for (const condition of Object.keys(authored)) {
    if (condition.startsWith('_') || !Object.prototype.hasOwnProperty.call(conditions, condition)) {
      continue
    }
    entries.push([condition, conditions[condition]])
    added.add(condition)
  }

  for (const [condition, target] of Object.entries(conditions)) {
    if (!added.has(condition)) entries.push([condition, target])
  }

  return Object.fromEntries(entries)
}

/** The conditions the pipeline owns (or re-inserts itself) on a build entry. */
const managedConditions = new Set([
  'source',
  'development',
  'monorepo',
  'types',
  'browser',
  'node',
  'import',
  'require',
  'default',
])

/**
 * Hand-written conditions the pipeline knows nothing about (`react-server`, `worker`,
 * `edge-light`, …), in authored order. `parseExports` spreads the raw entry, so they survive
 * on the parsed `PkgExport` beyond its typed fields.
 */
function pickCustomConditions(exp: PkgExport): [string, unknown][] {
  return Object.entries(exp).filter(
    ([condition, target]) =>
      !managedConditions.has(condition) && !condition.startsWith('_') && target !== undefined,
  )
}
