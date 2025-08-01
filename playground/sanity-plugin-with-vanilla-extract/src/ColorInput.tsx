import {Stack, Text} from '@sanity/ui'
import {input} from './styles.css'
import type {ColorInputProps} from './types'

export default function ColorInput(props: ColorInputProps): React.JSX.Element {
  return (
    <Stack gap={2}>
      <input
        {...props.elementProps}
        type="color"
        className={input}
        // @ts-expect-error - these are valid in Safari 18.4 and later
        colorspace={props.schemaType.options?.colorspace ?? 'limited-srgb'}
        alpha={props.schemaType.options?.alpha ? 'true' : undefined}
      />
      <Text as={'output' as 'label'} muted size={0} htmlFor={props.elementProps.id}>
        {props.value}
      </Text>
    </Stack>
  )
}
