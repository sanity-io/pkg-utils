import {useState} from 'react'
import {createGlobalStyle, css, styled} from 'styled-components'

const Button = styled.button<{$primary?: boolean}>`
  font-size: 16px;
  border-radius: 5px;
  padding: 0.25em 1em;
  margin: 1em 1em;
  background: transparent;
  color: palevioletred;
  border: 2px solid palevioletred;
  cursor: pointer;

  ${(props) =>
    props.$primary &&
    css`
      background: palevioletred;
      color: white;
    `};
`

const GlobalStyle = createGlobalStyle`
  body {
    font-size: 16px;
    line-height: 1.2;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
    font-style: normal;
    padding: 0;
    margin: 0;
    color: rgb(46, 68, 78);
    -webkit-font-smoothing: subpixel-antialiased;
  }

  * {
    box-sizing: border-box;
  }
`

const Body = styled.main`
  width: 100vw;
  min-width: 100vw;
  min-height: 100vh;

  background-image: linear-gradient(20deg, #e6356f, #69e7f7);

  padding: 30px 20px;
`

const Heading = styled.div`
  text-align: center;
`

const Title = styled.h1`
  @media (max-width: 40.625em) {
    font-size: 26px;
  }
`

const Subtitle = styled.p``

const Content = styled.div`
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 860px;

  margin: 0 auto;
  margin-top: 60px;
`

const Code = styled.span`
  white-space: pre;
  vertical-align: middle;
  font-family: monospace;
  display: inline-block;
  background-color: #1e1f27;
  color: #c5c8c6;
  padding: 0.1em 0.3em 0.15em;
  font-size: 0.8em;
  border-radius: 0.2em;
`

/** @public */
export function Story() {
  const [, setCount] = useState(0)

  return (
    <Body>
      <GlobalStyle />
      <Heading>
        <Title>
          Interactive sandbox for <Code>styled-components</Code>
        </Title>
        <Subtitle>
          Make changes to the files in <Code>./src</Code> and see them take effect in realtime!
        </Subtitle>
      </Heading>
      <Content>
        <Button onClick={() => setCount((prev) => ++prev)}>Increment</Button>
        <Button $primary onClick={() => setCount((prev) => --prev)}>
          Decrement
        </Button>
      </Content>
    </Body>
  )
}
