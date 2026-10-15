'use strict'

import {css} from '#styled-system/css'

export const strictBox: string = css({display: 'flex'})

/** `this` is only `undefined` in a plain function call under strict mode. */
export function isStrict(): boolean {
  return (function (this: unknown) {
    return this === undefined
  })()
}
