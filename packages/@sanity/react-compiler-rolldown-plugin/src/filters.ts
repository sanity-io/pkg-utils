import type {Surface} from './surfaces.ts'

/**
 * Matches the module ids the transform should consider: JS/TS sources (including the `m`/`c`
 * flavors), tolerating id queries (`?v=…` and friends).
 * @public
 */
export const transformIdFilter: RegExp = /\.[cm]?[jt]sx?(?:$|\?)/

/**
 * Matches ids that must never be transformed: anything inside `node_modules` (published
 * libraries pre-compile with their own toolchain; the surfaces annotation is for authored
 * source), and virtual (`\u0000`-prefixed) plugin modules.
 * @public
 */
// eslint-disable-next-line no-control-regex -- the `\u0000` prefix is rollup's virtual-module marker
export const excludeIdFilter: RegExp = /^\u0000|[\\/]node_modules[\\/]/

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A `code` pre-filter for the given surfaces: matches when the source mentions any anchor
 * token (callee or type-annotation name), so bundlers skip the parse for modules that cannot
 * possibly contain an anchor. The transform re-checks imports properly; this only has to be
 * fast, not precise.
 * @public
 */
export function surfaceAnchorPattern(surfaces: readonly Surface[]): RegExp {
  const tokens = new Set<string>()
  for (const surface of surfaces) {
    for (const name of surface.callees?.names ?? []) tokens.add(name)
    for (const name of surface.typeAnnotations?.names ?? []) tokens.add(name)
  }
  return new RegExp([...tokens].map(escapeRegExp).join('|'))
}
