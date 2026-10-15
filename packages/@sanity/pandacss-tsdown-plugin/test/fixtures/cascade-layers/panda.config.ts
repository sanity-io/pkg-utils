import {defineConfig, type Config} from '@pandacss/dev'

// Something in every layer Panda emits: the preflight (`reset`), a global style (`base`), tokens
// and keyframes (`tokens`), a config recipe with states, variants and a compound variant, and a
// slot recipe (`recipes`, `recipes.slots`), and utilities with a state, a breakpoint and a text
// style (`utilities`, `utilities.compositions`).
export default defineConfig({
  presets: [],
  preflight: true,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  outExtension: 'js',
  importMap: '#styled-system',
  conditions: {
    hover: '&:is(:hover, [data-hover])',
    focusVisible: '&:is(:focus-visible, [data-focus-visible])',
    selected: '&:is([aria-selected=true], [data-selected])',
  },
  globalCss: {
    button: {fontWeight: '600'},
  },
  theme: {
    breakpoints: {md: '768px'},
    keyframes: {spin: {to: {transform: 'rotate(360deg)'}}},
    textStyles: {body: {value: {fontSize: '16px'}}},
    tokens: {
      colors: {brand: {value: '#f03e2f'}, ink: {value: '#101112'}, hover: {value: '#0000ff'}},
    },
    recipes: {
      button: {
        className: 'button',
        base: {
          color: 'ink',
          outlineWidth: '0px',
          _hover: {color: 'hover'},
          _focusVisible: {outlineWidth: '2px'},
          _selected: {fontWeight: '700'},
        },
        variants: {
          tone: {brand: {color: 'brand'}},
          size: {lg: {fontSize: '20px', fontWeight: '500'}},
        },
        compoundVariants: [{tone: 'brand', size: 'lg', css: {fontWeight: '800'}}],
      },
    },
    slotRecipes: {
      card: {
        className: 'card',
        slots: ['root', 'title'],
        base: {root: {color: 'ink'}, title: {fontWeight: '700'}},
        variants: {tone: {brand: {root: {color: 'brand'}}}},
      },
    },
  },
  utilities: {
    color: {values: 'colors'},
    fontWeight: {},
    fontSize: {},
    outlineWidth: {},
    animation: {},
    textStyle: {},
  },
} satisfies Config)
