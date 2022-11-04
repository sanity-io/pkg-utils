export * from './module2'

/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface _Dummy {
  field: string
}

declare module './module2' {
  export interface IncludedModuleDummy {
    addedField: string
  }
}

/**
 * declare module './module2' {
 *  interface TSDocsDummy {
 *    field: string
 *  }
 * }
 */

/*
  declare module './module2' {
   interface BlockCommentDummy {
     field: string
   }
  }
    */

// declare module './module2' {
//  interface CommentDummy {
//    field: string
//  }
// }
