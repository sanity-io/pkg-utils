/**
 * Shared between the `index` and `theme` entries, mirroring `@sanity/ui`, where code shared
 * between entries forms a chunk that rolldown also names `theme`, colliding with the `theme`
 * entry filename (https://github.com/sanity-io/ui/issues/2262).
 */
export interface ThemeConfig {
  scheme?: 'light' | 'dark'
}

export function buildTheme(config: ThemeConfig = {}): Required<ThemeConfig> {
  return {scheme: config.scheme ?? 'light'}
}
