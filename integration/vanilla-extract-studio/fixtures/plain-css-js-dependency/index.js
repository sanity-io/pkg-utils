// Mirrors how @bynder/compact-view consumes its Styles.css.js (a default-imported CSS string
// that the package injects into a shadow root at runtime).
import styles from './Styles.css.js'

function getPlainCssJsStyles() {
  return styles
}
export {getPlainCssJsStyles}
