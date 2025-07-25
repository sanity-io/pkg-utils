import {TextInput} from '@sanity/ui'
import type {StringInputProps} from 'sanity'
import {styled} from 'styled-components'

const CustomTextInput = styled(TextInput)``

/** @public */
export interface ColorInputProps extends StringInputProps {}

export default function ColorInput(props: StringInputProps): React.JSX.Element {
  return <CustomTextInput {...props.elementProps} type="color" />
}
