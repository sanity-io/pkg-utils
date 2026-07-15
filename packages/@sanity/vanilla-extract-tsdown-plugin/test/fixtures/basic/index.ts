import {box} from './styles.css.ts'

/**
 * Returns the vanilla-extract generated class name. The styles themselves are extracted into a
 * separate CSS asset by the plugin.
 */
export function getClassName(): string {
  return box
}
