import {css} from '#styled-system/css'

// A conditional composition: the transformer still resolves it statically
export function toggle(active: boolean): string {
  return css({display: 'flex'}, active && {color: 'brand'})
}

// A dynamic value: no static CSS can be generated for it, so the call stays and runs through
// Panda's runtime (and Panda reports a `panda_call_unextractable` diagnostic for it)
export function pick(color: 'brand' | 'rgb(1, 2, 3)'): string {
  return css({color})
}
