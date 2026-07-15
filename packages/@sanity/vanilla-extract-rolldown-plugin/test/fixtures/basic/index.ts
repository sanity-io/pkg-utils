import {getButtonClassName} from './button.ts'
import {box} from './styles.css.ts'

/**
 * Returns the vanilla-extract generated class names. The styles themselves are extracted into a
 * separate CSS asset by the plugin.
 */
export function getClassNames(): string {
  return `${getButtonClassName()} ${box}`
}
