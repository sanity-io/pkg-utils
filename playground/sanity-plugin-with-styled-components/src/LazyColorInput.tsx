import {lazy} from 'react'
import type {ColorInputProps} from './types'

/** @public */
export const ColorInput: React.LazyExoticComponent<React.ComponentType<ColorInputProps>> = lazy(
  () => import('./ColorInput'),
)
