import {css} from '#styled-system/css'
import {button, card} from '#styled-system/recipes'

export const brandButton: string = button({tone: 'brand', size: 'lg'})
export const brandCard: string = card({tone: 'brand'}).root

export const inkText: string = css({color: 'ink', _hover: {color: 'brand'}})
export const lightText: string = css({fontWeight: '300', fontSize: '12px'})
export const prose: string = css({textStyle: 'body', md: {fontSize: '24px'}})
export const spinner: string = css({animation: 'spin 1s'})
export const loudText: string = css({color: 'brand!'})
