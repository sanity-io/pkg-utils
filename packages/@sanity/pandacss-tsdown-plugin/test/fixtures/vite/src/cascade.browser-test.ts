import '../panda.css'
import '../consumer.css'
import {expect, test} from 'vitest'
import {brandButton} from './styles.ts'

function render(className: string, attributes: Record<string, string> = {}): CSSStyleDeclaration {
  const button = document.createElement('button')
  button.className = className
  for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value)
  document.body.append(button)
  return getComputedStyle(button)
}

test("generates Panda's CSS without cascade layers", () => {
  const rules = [...document.styleSheets].flatMap((sheet) => Array.from(sheet.cssRules))
  const layerRules = rules.filter(
    (rule) => rule instanceof CSSLayerBlockRule || rule instanceof CSSLayerStatementRule,
  )
  expect(layerRules).toEqual([])
  expect(rules.some((rule) => rule.cssText.startsWith('.button--tone_brand'))).toBe(true)
})

test("lets the app's CSS override Panda's base styles, but not its states", () => {
  // `button` from consumer.css beats the base layer's `button {font-weight: 600}`…
  expect(render('').fontWeight).toBe('400')
  // …but not the recipe's selected and hover states, which are more specific
  expect(render(brandButton, {'aria-selected': 'true'}).fontWeight).toBe('700')
  expect(render(brandButton, {'data-hover': ''}).color).toBe('rgb(0, 0, 255)')
})
