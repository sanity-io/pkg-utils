/**
 * Deterministic synthetic `.css.ts` corpus for the debug-IDs parser bench-off. The shapes and
 * proportions mirror a large real-world vanilla-extract codebase (think sanity-io/sanity after
 * a styled-components migration): hundreds of files at 50-300 lines, dominated by `style()`
 * calls with nested selector/media blocks, plus themes, variants, recipes, keyframes, vars,
 * nested-object exports, and the occasional explicit debug ID.
 */

/** mulberry32: tiny deterministic PRNG so every bench run sees the identical corpus. */
function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const colors = ['tomato', 'rebeccapurple', 'lightseagreen', 'goldenrod', 'slateblue', 'crimson']

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)]
  if (item === undefined) throw new Error('empty pick')
  return item
}

function styleObject(rng: () => number, indent: string, depth = 0): string {
  const properties = [
    `color: '${pick(rng, colors)}'`,
    `padding: '${Math.floor(rng() * 32)}px'`,
    `margin: '${Math.floor(rng() * 16)}px auto'`,
    `display: 'flex'`,
    `flexDirection: 'column'`,
    `gap: '${Math.floor(rng() * 12)}px'`,
    `borderRadius: '${Math.floor(rng() * 8)}px'`,
    `fontSize: '${12 + Math.floor(rng() * 12)}px'`,
    `lineHeight: ${(1 + rng()).toFixed(2)}`,
    `zIndex: ${Math.floor(rng() * 100)}`,
  ]
  const count = 3 + Math.floor(rng() * (properties.length - 3))
  const lines = properties.slice(0, count).map((property) => `${indent}  ${property},`)

  if (depth === 0 && rng() > 0.5) {
    lines.push(`${indent}  selectors: {`)
    lines.push(`${indent}    '&:hover': {`)
    lines.push(`${indent}      color: '${pick(rng, colors)}',`)
    lines.push(`${indent}    },`)
    lines.push(`${indent}  },`)
  }
  if (depth === 0 && rng() > 0.7) {
    lines.push(`${indent}  '@media': {`)
    lines.push(`${indent}    'screen and (min-width: 768px)': {`)
    lines.push(`${indent}      padding: '${Math.floor(rng() * 48)}px',`)
    lines.push(`${indent}    },`)
    lines.push(`${indent}  },`)
  }

  return `{\n${lines.join('\n')}\n${indent}}`
}

function generateFile(index: number): string {
  const rng = createRng(index + 1)
  const usesRecipe = rng() > 0.6
  const blocks: string[] = [
    `import {style, styleVariants, createVar, createTheme, keyframes, fontFace} from '@vanilla-extract/css'`,
  ]
  if (usesRecipe) {
    blocks.push(`import {recipe} from '@vanilla-extract/recipes'`)
  }

  const blockCount = 4 + Math.floor(rng() * 14)
  for (let block = 0; block < blockCount; block++) {
    const kind = rng()
    if (kind < 0.4) {
      blocks.push(`export const element${block}: string = style(${styleObject(rng, '')})`)
    } else if (kind < 0.5) {
      blocks.push(
        `export const variants${block} = styleVariants({`,
        `  primary: ${styleObject(rng, '  ', 1)},`,
        `  secondary: ${styleObject(rng, '  ', 1)},`,
        `})`,
      )
    } else if (kind < 0.58) {
      blocks.push(`export const [theme${block}, vars${block}] = createTheme({`)
      blocks.push(`  space: {small: '4px', medium: '8px', large: '16px'},`)
      blocks.push(`  color: {brand: '${pick(rng, colors)}'},`)
      blocks.push(`})`)
    } else if (kind < 0.66) {
      blocks.push(`export const accent${block} = createVar()`)
    } else if (kind < 0.74) {
      blocks.push(
        `export const spin${block} = keyframes({`,
        `  from: {transform: 'rotate(0deg)'},`,
        `  to: {transform: 'rotate(360deg)'},`,
        `})`,
      )
    } else if (kind < 0.8 && usesRecipe) {
      blocks.push(
        `export const button${block} = recipe({`,
        `  base: ${styleObject(rng, '  ', 1)},`,
        `  variants: {`,
        `    tone: {`,
        `      critical: ${styleObject(rng, '      ', 1)},`,
        `      positive: ${styleObject(rng, '      ', 1)},`,
        `    },`,
        `  },`,
        `})`,
      )
    } else if (kind < 0.86) {
      blocks.push(
        `export const card${block} = {`,
        `  header: style(${styleObject(rng, '  ', 1)}),`,
        `  body: [style(${styleObject(rng, '  ', 1)})],`,
        `}`,
      )
    } else if (kind < 0.92) {
      blocks.push(`const makeStyle${block} = () => style(${styleObject(rng, '')})`)
      blocks.push(`export const made${block} = makeStyle${block}()`)
    } else if (kind < 0.96) {
      blocks.push(`export const named${block} = style(${styleObject(rng, '')}, 'explicit${block}')`)
    } else {
      blocks.push(
        `export const face${block} = fontFace({`,
        `  src: 'local("Comic Sans MS")',`,
        `})`,
      )
    }
    blocks.push('')
  }

  return blocks.join('\n')
}

/**
 * Generates the corpus. Size is overridable through `VE_BENCH_DEBUG_IDS_FILES` (default 500
 * files), mirroring the `VE_BENCH_*` conventions of `benchmarks/vanilla-extract`.
 */
export function generateCorpus(
  fileCount = Number(process.env['VE_BENCH_DEBUG_IDS_FILES'] ?? 500),
): string[] {
  return Array.from({length: fileCount}, (_, index) => generateFile(index))
}
