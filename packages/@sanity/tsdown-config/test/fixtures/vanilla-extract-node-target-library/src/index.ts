import {box} from './styles.css.ts'

/**
 * Returns the vanilla-extract generated class name. The package builds with `target: 'node20'`,
 * so the CSS syntax lowering targets fall back to `@sanity/browserslist-config`.
 * @public
 */
export function getBoxClassName(): string {
  return box
}
