import {lazy} from 'react'
import type {ColorInputProps} from './ColorInput'

/** @public */
export const ColorInput: React.LazyExoticComponent<React.ComponentType<ColorInputProps>> = lazy(
  () => import('./ColorInput'),
)
