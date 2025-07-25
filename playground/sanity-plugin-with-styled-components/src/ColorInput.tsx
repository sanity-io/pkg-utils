import {Stack, Text} from '@sanity/ui'
import {styled} from 'styled-components'
import type {ColorInputProps} from './types'

const CustomTextInput = styled.input.attrs({type: 'color'})`
  cursor: pointer;
  box-sizing: border-box;
  background: var(--card-border-color);
  border: 0 solid transparent;
  border-radius: 2px;
  padding: 0;
  appearance: none;
  margin: 0;
  height: 1.6rem;
  width: 8ch;

  &:hover {
    box-shadow: 0 0 0 2px ${({theme}) => theme.sanity.color.card.hovered.border};
  }

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    padding: 0;
    border: 0 solid transparent;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px ${({theme}) => theme.sanity.color.card.enabled.fg};

    @supports (color: rgb(from white r g b / 20%)) {
      box-shadow: inset 0 0 0 1px
        rgb(from ${({theme}) => theme.sanity.color.card.enabled.fg} r g b / 20%);
    }
  }

  &::-moz-color-swatch {
    padding: 0;
    border: 0 solid transparent;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px ${({theme}) => theme.sanity.color.card.enabled.fg};

    @supports (color: rgb(from white r g b / 20%)) {
      box-shadow: inset 0 0 0 1px
        rgb(from ${({theme}) => theme.sanity.color.card.enabled.fg} r g b / 20%);
    }
  }
`

export default function ColorInput(props: ColorInputProps): React.JSX.Element {
  return (
    <Stack space={2}>
      <CustomTextInput
        {...props.elementProps}
        // @ts-expect-error - these are valid in Safari 18.4 and later
        colorspace={props.schemaType.options?.colorspace ?? 'limited-srgb'}
        alpha={props.schemaType.options?.alpha ? 'true' : undefined}
      />
      <Text as="output" muted size={0} htmlFor={props.elementProps.id}>
        {props.value}
      </Text>
    </Stack>
  )
}
