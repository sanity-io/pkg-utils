import {css} from '#styled-system/css'

// Only dynamic values: Panda extracts nothing from this module and the transformer leaves it
// unchanged, but it still produces Panda class names at runtime
export function pick(color: string): string {
  return css({color})
}
