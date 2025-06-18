// @ts-expect-error unused
import {IncludedModuleDummy} from './module2'

// this should not appear in our final bundle
declare module './module2' {
  interface Excluded {
    field: string
  }
}
