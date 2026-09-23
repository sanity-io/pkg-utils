import {panel} from './layout.css.ts'
import {shown} from './overrides.css.ts'

/**
 * `layout.css.ts` is imported before `overrides.css.ts`, so under per-module compilation the
 * media-query rule of `panel` renders before the base rule of `shown`.
 */
export function getClassNames(): string {
  return `${panel} ${shown}`
}
