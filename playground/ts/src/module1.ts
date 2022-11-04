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
 * declare namespace ExcludedModule {
 *  interface TSDocsDummy {
 *    field: string
 *  }
 * }
 */

/*
  declare namespace ExcludedModule {
   interface BlockCommentDummy {
     field: string
   }
  }
    */

// declare namespace ExcludedModule {
//  interface CommentDummy {
//    field: string
//  }
// }
