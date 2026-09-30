# @sanity/vanilla-extract-styled-components

A tiny (< 1kB compressed) runtime for assigning [vanilla-extract](https://vanilla-extract.style)
CSS variables from [styled-components](https://styled-components.com) styles — the
[`@vanilla-extract/dynamic`](https://vanilla-extract.style/documentation/packages/dynamic/)
counterpart for CSS-in-JS template literals and object styles instead of the inline `style`
attribute.

The vanilla-extract APIs (`createVar`, `createThemeContract`, `createTheme`, …) produce variable
_references_ that contain the CSS `var()` function, e.g. `var(--brandColor__8uideo0)`. Reading a
variable in a styled-components style needs no help, the reference is a valid CSS value as-is:

```ts
const Section = styled.section`
  background: ${brandColor};
`
```

Setting it does: the declaration needs the bare custom property name, and there was no public
API for it — so codebases that mix the two libraries ended up hardcoding names like
`--avatar-size` on both sides. This package removes the wrapping function for you:

- [`assignVars`](#assignvars) turns `{[brandColor]: 'pink'}` into the declaration
  `--brandColor__8uideo0: pink;`, for `css`/`styled` template literals, object styles and
  `createGlobalStyle`.
- [`getVarName`](#getvarname) gives you the bare `--brandColor__8uideo0` for a hand-written
  declaration.

It has no dependencies and no build-time integration: the `.css.ts` files are compiled by whatever
vanilla-extract plugin you already use (for example
[`@sanity/vanilla-extract-vite-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-vite-plugin#readme)
or `@sanity/pkg-utils`), and the styled-components side is plain runtime CSS-in-JS.

## Usage

```sh
pnpm add @sanity/vanilla-extract-styled-components
```

## assignVars

Assigns variables that have been created with the vanilla-extract APIs from a styled-components
style. Variables with a value of `null` or `undefined` are omitted from the resulting declarations.

```ts
// styles.css.ts
import {createVar, style} from '@vanilla-extract/css'

export const brandColor = createVar()
export const textColor = createVar()

export const container = style({
  background: brandColor,
  color: textColor,
})
```

```tsx
// Section.tsx
import {assignVars} from '@sanity/vanilla-extract-styled-components'
import {styled} from 'styled-components'
import {brandColor, container, textColor} from './styles.css'

// If `$tone` is undefined, the generated class only declares:
// --brandColor__8uideo0: pink;
const Root = styled.section<{$tone?: 'critical'}>`
  ${({$tone}) =>
    assignVars({
      [brandColor]: 'pink',
      [textColor]: $tone === 'critical' ? 'red' : null,
    })}
`

export const Section = (props: {tone?: 'critical'}) => (
  <Root className={container} $tone={props.tone}>
    ...
  </Root>
)
```

The result is a plain object of `--name: value` pairs, so styled-components accepts it wherever
it accepts an object style: interpolated into a template literal (as above, statically or from a
style function), passed to `styled()` or `css()` directly, spread into a larger object style, or
nested under a selector or media query. Its `toString()` renders the same declarations as CSS
text (`--brandColor__8uideo0: pink;`, each terminated by a semicolon), so plain template strings
work too:

```ts
const Card = styled.div<{$size: string}>(({$size}) => ({
  ...assignVars({[avatarSize]: $size}),
  width: avatarSize,
}))

const stylesheet = `.card { ${assignVars({[brandColor]: 'pink'})} }`
```

### Assigning per breakpoint

Because the declarations land in a generated class rather than an inline `style` attribute, they
take part in the cascade like any other styled-components CSS: a media query can override them,
which an inline custom property could never be. This is the case that used to need the hardcoded
variable — a responsive `size` prop of a component whose parts are sized from a vanilla-extract
variable:

```ts
// avatar.css.ts
import {createVar, style} from '@vanilla-extract/css'

export const avatarSize = createVar()

export const avatarImage = style({
  width: avatarSize,
  height: avatarSize,
  borderRadius: '50%',
})
```

```ts
// avatar.tsx
import {assignVars} from '@sanity/vanilla-extract-styled-components'
import {styled, type CSSObject} from 'styled-components'
import {avatarSize} from './avatar.css'

const media = ['', '@media (min-width: 640px)', '@media (min-width: 960px)']

// [`1.1875rem`, `2.0625rem`] sizes the avatar 19px wide, and 33px from 640px up
function responsiveAvatarSize(sizes: string[]): CSSObject[] {
  return sizes.map((size, index) => {
    const declarations = assignVars({[avatarSize]: size})
    const query = media[index]

    return query ? {[query]: declarations} : declarations
  })
}

export const AvatarRoot = styled.div<{$size: string[]}>(({$size}) => responsiveAvatarSize($size))
```

### Assigning theme contracts

Theme contracts can be assigned by passing one as the first argument. All variables must be
assigned or it's a type error — which makes dynamic theming with `createGlobalStyle` (or a
`ThemeProvider`-driven wrapper element) straightforward:

```ts
// theme.css.ts
import {createThemeContract} from '@vanilla-extract/css'

export const themeVars = createThemeContract({
  color: {brand: null},
  font: {body: null},
})
```

```ts
// GlobalTheme.tsx
import {assignVars} from '@sanity/vanilla-extract-styled-components'
import {createGlobalStyle} from 'styled-components'
import {themeVars} from './theme.css'

export const GlobalTheme = createGlobalStyle<{$brand: string; $font: string}>`
  :root {
    ${({$brand, $font}) =>
      assignVars(themeVars, {
        color: {brand: $brand},
        font: {body: $font},
      })}
  }
`
```

## getVarName

Extracts the custom property name from a variable reference, for declarations you write by hand
in a template literal — for example to keep the value a styled-components interpolation of its
own:

```ts
import {getVarName} from '@sanity/vanilla-extract-styled-components'
import {styled} from 'styled-components'
import {avatarSize} from './avatar.css'

// --avatarSize__1e5vhas0: 33px;
const AvatarRoot = styled.div<{$size: number}>`
  ${getVarName(avatarSize)}: ${({$size}) => `${$size}px`};
`
```

It accepts everything the vanilla-extract APIs return — `createVar()` and `createGlobalVar()`
references, theme contract leaves, and `fallbackVar()` references (`var(--name, fallback)` yields
`--name`, since the fallback only matters when reading) — as well as hand-written `--names`, and
throws for anything else instead of letting a `brandColor: pink;` declaration slip into your CSS.

## Why not `assignInlineVars`?

[`@vanilla-extract/dynamic`](https://vanilla-extract.style/documentation/packages/dynamic/) is the
right tool when the value lives on one element and comes from runtime data (`style={assignInlineVars(...)}`).
Inline styles sit outside the cascade, though: they cannot be overridden by a media query,
targeted from a parent selector, or shared by a class, and they don't compose with the rest of a
component's styled-components CSS. `assignVars` produces the same declarations, but as part of the
styled-components class — the object it returns even has the same shape as `assignInlineVars`'
result, so the two can be swapped as a component's needs change.

## Acknowledgements

The API mirrors
[`@vanilla-extract/dynamic`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/dynamic),
and the variable-name and theme-contract helpers derive from
[`@vanilla-extract/private`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/private)
(both MIT licensed, Copyright (c) 2021 SEEK). The full combined license notices are in this
package's [LICENSE](./LICENSE) file.
