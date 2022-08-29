export function p(name: string): string {
  if (typeof window === undefined) return `/${name}`

  return `${window.location}/${name}`
}
