# `atomic: 'priority'` — StyleX-parity atomic CSS (design)

Status: design + prototype. The priority computation ships in `src/atomic/priorities.ts` (tested
against StyleX's tables in `test/priorities.test.ts`); nothing else described here is built yet,
and the mode is not exposed by any plugin option.

## Why a second mode

The shipped `atomic: true` pass is _strictly safe_: it renders each declaration of a `style()`
rule as a single-declaration class and shares identical declarations, but only when sharing
cannot change the outcome of any class combination an element could carry. Since vanilla-extract
compositions are plain class strings (`'a1 display_block__x'`) that users concatenate freely
(`clsx(a, b)`, a `className` prop next to a recipe result), the pass has to keep the relative
order of every pair of overlapping declarations. Whenever an overlapping declaration renders
between two identical ones, they cannot share:

```ts
const a = style({display: 'block'})
const b = style({display: 'inline'})
const c = style({display: 'block'}) // a's class would have to sit both before and after b's
```

StyleX shares `display: block` here unconditionally, because it does not let two classes for
the same property reach one element in the first place: `stylex.props(a, b)` merges the styles
per property key at runtime (last wins), and the CSS is ordered by a _priority_ that depends only
on the declaration (which property, which pseudos, which at-rules) — never on source order. That
is a different contract, which is why it is a second, opt-in mode rather than a knob on the safe
one. `atomic: 'priority'` is that contract for `.css.ts` modules.

## The contract

1. **One class per distinct declaration, program-wide.** A declaration is the tuple
   `(conditions, selector template, property, value)`; identical tuples share one class
   wherever they occur, across modules, chunks and separately built packages.
2. **The cascade is decided by priority, then by program order.** Every atomic rule is placed
   by its priority (below); two rules of different priority never depend on source order. Two
   rules of the same priority only compete when they set the same property with different
   values, and that competition is what `cx()` resolves — for raw string concatenation the
   winner is the declaration that appears later in program order, whatever the class order in
   the attribute.
3. **Longhands beat shorthands** (`paddingBottom` wins over `padding`), pseudo-classes beat the
   plain rule in lvfha order, at-rule variants beat unconditional ones, whatever order they were
   written in. This is StyleX's default `styleResolution: 'property-specificity'`.
4. **Identity classes stay, first**, exactly as in the safe mode: `${a} &` selectors,
   `globalStyle(`${a} svg`)`, recipes' `classNames.base` and debug identifiers keep working, and
   anything the pass cannot make atomic stays on them.

What it costs: `clsx(a, b)` no longer means "b's declarations win"; where two composed styles set
the same property, `cx(a, b)` (or a compile-time composition) is required to get that meaning.
That is the migration StyleX asks of its users too.

## Class names: content-addressed and self-describing

The safe mode names an atomic class by hashing the declaration together with the scope
(`fileScope` or `'program'`) so that the class can only be shared within the scope the barrier
analysis covered. Priority mode has no barriers and no scope, so the name is a pure content hash
of the tuple:

```
_<keyHash>_<valueHash>                                short
<property>_<value-slug>__<keyHash>_<valueHash>        debug
```

`keyHash` hashes `(conditions, selector template, property)` — the _key_ StyleX merges on —
and `valueHash` hashes the value. Splitting them makes the class name self-describing: two
classes with the same `keyHash` are alternatives for the same declaration key, so a runtime can
merge class lists per key **without any registry**, by keeping the last class of each `keyHash`.
That is what keeps `cx()` tiny (see below) and keeps exports plain strings, unlike StyleX's
compiled style objects. Identity classes never end in the `_<7>_<7>` shape (vanilla-extract's
`generateIdentifier` ends them in `__<hash><n>`, or in `<hash><n>` in short mode), so `cx()`
passes them through untouched; a custom `identifiers` function has to keep that property.

Because the name does not depend on where the declaration was written, the same declaration
compiled in `@sanity/ui` and in `sanity` produces byte-identical rules; a CSS bundler that
concatenates both stylesheets emits the rule twice, harmlessly, and a deduplicating one once.
The `identifiers` function option still receives `{hash, debugId, filePath, packageName}`, with
`filePath` being the first module that declared the tuple in program order.

## Priorities

`declarationPriority({property, conditions, selector})` in `src/atomic/priorities.ts` is
StyleX's `getPriority` expressed over this package's property tables:

| what                                                                     |       priority | source                                         |
| ------------------------------------------------------------------------ | -------------: | ---------------------------------------------- |
| custom property (`--x`)                                                  |              1 | fixed                                          |
| shorthand that sets other shorthands (`all`, `border`, `margin`, `font`) |           1000 | `isShorthandOfShorthands` (table + sided rule) |
| shorthand (`borderWidth`, `marginBlock`, `flex`)                         |           2000 | `isShorthand` (mdn-data)                       |
| logical or unclassified longhand (`marginBlockStart`, `color`)           |           3000 | `isLogicalLonghand`, default                   |
| physical longhand with a logical counterpart (`marginTop`, `width`)      |           4000 | `hasLogicalCounterpart`                        |
| `+` each pseudo-class (`:hover` 130, `:focus` 150, `:active` 170, …)     |         40–170 | StyleX's table, CSS spellings                  |
| `+` each pseudo-element (`::before`)                                     |           5000 | fixed                                          |
| `+` `@supports` / `@media` / `@container`                                | 30 / 200 / 300 | StyleX's table; other at-rules add 0           |

The tests prove the property part is consistent: every shorthand in the table ranks below every
longhand it sets, and every logical longhand below the physical ones it can resolve to. Against
StyleX's own sets the only differences are properties that became shorthands after StyleX's
table was written (`white-space`, `text-wrap`, `border-block-*`), `contain-intrinsic-*` (which
have logical counterparts and so rank as physical), `line-clamp`/`max-lines` (which have none),
and `grid-template` (a shorthand `grid` sets, which StyleX ranks next to `grid`).

## Rendering

The renderer keeps the safe pass's `splitAtomic` (one entry per declaration, templates over the
identity class) and replaces the barrier analysis with a sort:

1. Group atomic entries by their _user_ `@layer` path (vanilla-extract's `layer()` API), outer
   grouping first — priorities order the cascade within a layer, they cannot reach across layers.
2. Within a group, stable-sort by `declarationPriority`; ties keep program order (contract 2).
3. Wrap each priority band (`priorityLayer(priority)`, i.e. the thousands) so that a
   higher band beats a lower one regardless of specificity or order:
   - default: append `:not(#\#)` once per band index to the selector
     (`.x:not(#\#):not(#\#)` for band 2), StyleX's default. Atomic rules then have ID-level
     specificity and beat any unlayered single-class rule of the host page, and the order in
     which chunks load stops mattering.
   - `layers: true`: emit `@layer priority0, priority1, …;` first and wrap each band in its
     `@layer`. Cleaner CSS, but unlayered host CSS (resets, third-party stylesheets) then beats
     every atomic rule; only for apps that layer everything.
4. Residual rules (selector lists, `& + &`, `.parent &` on a class other than the style's own,
   `globalStyle`, keyframes, `createTheme` variables, font-faces) render before the atomic bands
   in program order and stay outside the bands: an unbumped residual rule cannot beat a bumped
   atomic one, which is the same relationship those selectors have to StyleX-managed styles.

Because the placement is encoded in the selector (or the layer), a stylesheet can be split per
chunk and loaded in any order — which is what lets `compilation: 'whole-program'` serve Vite
_builds_ too (today it is serve-only, since a Vite build's per-chunk CSS would lose the program
order the safe mode relies on).

## Compositions

vanilla-extract has two kinds of composition and the mode treats them differently:

- **Compile-time**: `style([a, {paddingBottom: 0}])`, `styleVariants`, sprinkles' generated
  classes. The compiler sees both operands' declarations (the program adapter records every
  `style()` rule), so it merges them per key like StyleX's `application-order` resolution:
  the later operand wins, and a later shorthand _nulls_ the earlier longhands it covers
  (`propertiesOverlap` is exactly that relation). The composition exports
  `'c1 <atomics of the merged object>'` — the same string shape as today, no runtime.
- **Runtime**: `recipe()` variants, `clsx(a, b)`, `className` props. Only `cx()` can merge
  these, and it can only see class names, not declarations, so it applies property-specificity
  (the priorities) plus last-wins per key. A variant that sets `padding` over a base
  `paddingTop` therefore does _not_ reset it; the compiler reports that case as a diagnostic
  ("use longhands in variants") — StyleX's documented guidance for the same limitation.

## Runtime

A small `@sanity/vanilla-extract-runtime` package (or an export of the integration) with:

- `cx(...classLists)`: splits the inputs, keeps identity classes and non-atomic tokens, and for
  atomic tokens keeps the last one per `keyHash`. Memoized per input tuple like styleq. No
  property table, no registry — the names carry the key.
- A forked `createRuntimeFn` for `recipe()` that composes base, variants and compound variants
  through `cx()` instead of string concatenation, so `variants.size.small` beats `base` per key.

Neither is needed for code that never combines styles setting the same property; identity
classes plus atomic classes are still plain strings.

## What the mode gives up

- **Order-based overrides.** The whole point: `clsx(a, b)` stops meaning "b wins" for
  same-property conflicts; that is `cx(a, b)` or a compile-time composition.
- **Specificity neutrality.** With the default `:not(#\#)` placement, atomic rules have ID-level
  specificity; plain host CSS can no longer override a studio style without `!important` or an
  ID selector. `layers: true` flips that trade-off.
- **CSS tree-shaking.** The stylesheet is the union of every declaration in the program, like
  whole-program mode today; a module nothing imports still contributes its classes (the
  `unreached modules` warning covers it).
- **Upstream parity.** The mode is a vanilla-extract dialect: output is only comparable to
  upstream by computed styles under `cx()` semantics, not rule for rule.

## Plan

1. `planPriorityClasses` next to `planAtomicClasses`: content-hash naming, per-user-layer
   grouping, priority sort, band wrapping (`:not(#\#)` / `@layer`), residual placement.
   `renderStylesheet({atomic: {mode: 'priority', layers}})`.
2. Compile-time composition merge in the program adapter (`registerComposition` gives the
   operands; the recorded rules give their declarations), with the shorthand nulling.
3. `cx()` and the `recipe()` runtime fork; the "shorthand over longhand in a runtime
   composition" diagnostic.
4. Plugin option `atomic: 'priority' | {mode: 'priority', layers?: boolean, report?: boolean}`;
   whole-program for Vite builds.
5. Tests: the Chromium cascade-equivalence harness rerun under `cx()` semantics (every
   combination compared against the per-key merge of the style objects, not against the
   non-atomic stylesheet), a StyleX differential for the priorities (done), the studio
   integration suite as the migration probe for Sanity's own composition patterns.
