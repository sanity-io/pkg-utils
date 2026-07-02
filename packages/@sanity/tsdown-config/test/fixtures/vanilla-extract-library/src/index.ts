import {box} from './styles.css.ts'

/**
 * Returns the vanilla-extract generated class name. The styles themselves are extracted into
 * `bundle.css`, which the built entry chunk loads through the injected self-referential
 * `import "@fixtures/vanilla-extract-library/bundle.css"` statement.
 * @public
 */
export function getBoxClassName(): string {
  return box
}
