---
'@sanity/vanilla-extract-styled-components': minor
---

Add `@sanity/vanilla-extract-styled-components`: the `@vanilla-extract/dynamic` counterpart for styled-components. `assignVars({[brandColor]: 'pink'})` turns vanilla-extract variable references (`var(--brandColor__8uideo0)`) into the custom property declarations a `css`/`styled` template literal, object style or `createGlobalStyle` needs to set them (`--brandColor__8uideo0: pink;`), with the same `null`/`undefined` skipping and theme-contract overload as `assignInlineVars` — and, unlike inline styles, the declarations take part in the cascade, so responsive props can assign a variable per breakpoint. `getVarName(brandColor)` exposes the bare property name for hand-written declarations (`${getVarName(avatarSize)}: ${({$size}) => rem($size)};`), which previously had no public API and led to hardcoded variable names shared between `.css.ts` files and styled-components.
