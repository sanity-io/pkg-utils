// Mirrors how @bynder/compact-view consumes its Styles.css.js (a default-imported CSS string
// that the package injects into a shadow root at runtime).
import {createFunctionStyles} from './FunctionStyles.css.js'
import styles from './Styles.css.js'

function getPlainCssJsStyles() {
  return styles
}

function getFunctionCssJsStyles(nonce) {
  return createFunctionStyles(nonce)
}
export {getFunctionCssJsStyles, getPlainCssJsStyles}
