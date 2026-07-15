import buttonStyles from './button.module.css'
import {box} from './styles.css.ts'

/**
 * Returns the vanilla-extract generated class name. Styles live in `bundle.css`, loaded through
 * the injected self-referential `import "@fixtures/…/bundle.css"`.
 * @public
 */
export function getBoxClassName(): string {
  return box
}

/**
 * Returns the CSS-modules class-name map from `button.module.css`. Scoped CSS is emitted to
 * `style.css` by `@tsdown/css`, and `css.inject: true` preserves the CSS import in the JS
 * output so consumers pick it up automatically.
 * @public
 */
export function getButtonStyles(): Readonly<Record<string, string>> {
  return buttonStyles
}
