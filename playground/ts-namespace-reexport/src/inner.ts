/** @alpha */
export function hello(): string {
  return 'hello'
}

/** @alpha */
export type Greeting = ReturnType<typeof hello>
