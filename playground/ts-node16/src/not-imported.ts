/* eslint-disable @typescript-eslint/no-unused-vars */
//@ts-expect-error unused
import {IncludedModuleDummy} from './module2.js'

//this should not appear in our final bundle
declare module './module2.js' {
  interface Excluded {
    field: string
  }
}
