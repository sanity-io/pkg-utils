// A second entry re-exporting the same namespace: the synthesized wrapper then lives in a
// shared chunk that both entries import, instead of in the entry declaration files themselves

/** @alpha */
export * as inner from './inner'
