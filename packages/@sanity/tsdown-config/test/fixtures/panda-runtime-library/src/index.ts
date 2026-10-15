import {css} from '#styled-system/css'

/**
 * With `transform: false` this call is left as is, so the package ships Panda's runtime (bundled
 * from `styled-system` through the `imports` map) and only the stylesheet is extracted.
 */
export function getBoxClassName(): string {
  return css({color: 'brand', display: 'flex'})
}
