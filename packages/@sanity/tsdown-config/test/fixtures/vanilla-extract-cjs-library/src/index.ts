import {box} from './styles.css.ts'

/**
 * Returns the vanilla-extract generated class name. The injected self-referential
 * `require("@fixtures/vanilla-extract-cjs-library/bundle.css")` must resolve to a no-op that a
 * CommonJS package can load in plain Node.
 * @public
 */
export function getBoxClassName(): string {
  return box
}
