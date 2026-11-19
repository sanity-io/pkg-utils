import {style} from '@vanilla-extract/css'

export const box: string = style({
  color: 'rgb(1, 2, 3)',
})

/** A real vanilla-extract module exporting something that can't be serialized: an authoring mistake. */
export const helper = (): string => 'not serializable'
