/** Matches the characters of a string a RegExp would read as syntax. */
const RE_REGEXP_SYNTAX = /[.*+?^${}()|[\]\\]/g

/**
 * A `watch.exclude` pattern for an absolute directory and everything in it, matching the path
 * with either separator (rolldown hands watch paths over as the OS spells them). Separators
 * match in runs, so a Windows UNC directory (`\\server\share\dist`) keeps its double leading
 * separator.
 * @internal
 */
export function directoryPattern(dir: string): RegExp {
  const segments = dir
    .split(/[\\/]+/)
    .filter((segment) => segment !== '')
    .map((segment) => segment.replace(RE_REGEXP_SYNTAX, '\\$&'))
  const prefix = /^[\\/]/.test(dir) ? '[\\\\/]+' : ''
  return new RegExp(`^${prefix}${segments.join('[\\\\/]+')}(?:[\\\\/]|$)`)
}
