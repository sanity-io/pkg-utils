import pc from 'picocolors'

/**
 * Greppable colour marker. Importing `picocolors` (CJS) into the `.css.ts` graph reproduces
 * the TypeGen/`sanity schema extract` failure mode when the compiler inherits
 * `ssr.noExternal: true` — ModuleRunner then inlines CJS and throws `module is not defined`.
 */
export const accentColor: string = 'rgb(1, 2, 3)'

// Keep the CJS import live so the compiler must resolve/evaluate it
void pc.green
