import {css} from '#styled-system/css'

export const cardClass = css({
  color: 'brand',
  padding: 'sm',
})

export function renderCard(label: string): string {
  return `<div class="${cardClass}">${label}</div>`
}
