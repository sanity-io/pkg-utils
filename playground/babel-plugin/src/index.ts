/** @public */
export function defineThing(options: {name: string; age: number}) {
  const {name, ...restOptions} = options

  return {name, rest: restOptions}
}
