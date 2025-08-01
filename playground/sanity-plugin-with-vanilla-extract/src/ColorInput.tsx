import {Root, Stack, Text} from '@sanity/ui'
import {input} from './styles.css'
import type {ColorInputProps} from './types'

export default function ColorInput(props: ColorInputProps): React.JSX.Element {
  return (
    <Root as="div" overflow="visible">
      <Stack gap={2}>
        <input
          {...props.elementProps}
          type="color"
          className={input}
          // @ts-expect-error - these are valid in Safari 18.4 and later
          colorspace={props.schemaType.options?.colorspace ?? 'limited-srgb'}
          alpha={props.schemaType.options?.alpha ? 'true' : undefined}
        />
        <output htmlFor={props.elementProps.id}>
          <Text muted size={0}>
            {props.value}
          </Text>
        </output>
      </Stack>
    </Root>
  )
}
