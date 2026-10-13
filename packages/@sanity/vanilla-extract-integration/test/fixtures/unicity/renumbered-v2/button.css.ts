import {style} from '@vanilla-extract/css'

/**
 * v2: the root moved to the top and a third style was added, renumbering every style —
 * mirroring the `@sanity/ui` 4.4.3 → 4.4.4 Button change behind SAPP-4639. Same version as
 * v1 on purpose, so only the content salt tells the builds apart.
 */
export const root: string = style({
  color: 'red',
})

export const overlay: string = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  background: 'var(--card-bg-color)',
})

export const extra: string = style({
  color: 'blue',
})
