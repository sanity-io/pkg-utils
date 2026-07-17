import type {StubInputProps} from './sanity-stub.ts'

export function CustomStringInput(props: StubInputProps): React.JSX.Element {
  return (
    <div>
      {props.renderDefault(props)}
      <span data-testid="char-count">
        Characters: {typeof props.value === 'string' ? props.value.length : 0}
      </span>
    </div>
  )
}
