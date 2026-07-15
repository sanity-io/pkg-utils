import {parseAst} from 'rolldown/parseAst'
import {describe, expect, it} from 'vitest'
import {parse as yukuParse} from 'yuku-parser'
import {injectDebugIds, type EstreeProgram} from '../src/debugIds.ts'

type Parse = (source: string) => EstreeProgram

/**
 * Both backends produce the same oxc-shaped TS-ESTree AST with UTF-16 offsets, so the test
 * cases run against each to prove the walker is parser-agnostic (and to keep the bench-off in
 * `bench/debug-ids.bench.ts` honest about comparing parsers, not behaviors).
 */
const parsers: ReadonlyArray<[string, Parse]> = [
  ['rolldown/parseAst (oxc)', (source) => parseAst(source, {lang: 'ts', preserveParens: false})],
  ['yuku-parser', (source) => yukuParse(source, {lang: 'ts', preserveParens: false}).program],
]

/**
 * The cases are ported from `@vanilla-extract/babel-plugin-debug-ids`'s own test suite (MIT
 * licensed, Copyright (c) 2021 SEEK). Unlike babel, the splice-based transform preserves the
 * input formatting byte-for-byte outside the touched calls, so the expectations are the exact
 * inputs with only the debug ID argument added. The upstream "already compiled" scenarios
 * (babel-compiled `_slicedToArray` destructures) are intentionally not ported: this transform
 * only ever sees authored source.
 */
const cases: ReadonlyArray<{name: string; source: string; expected?: string}> = [
  {
    name: 'style assigned to const',
    source: `import { style } from '@vanilla-extract/css';
const one = style({
  zIndex: 2,
});`,
    expected: `import { style } from '@vanilla-extract/css';
const one = style({
  zIndex: 2,
}, "one");`,
  },
  {
    name: 'styleVariants assigned to const',
    source: `import { styleVariants } from '@vanilla-extract/css';
const colors = styleVariants({
  red: { color: 'red' }
});`,
    expected: `import { styleVariants } from '@vanilla-extract/css';
const colors = styleVariants({
  red: { color: 'red' }
}, "colors");`,
  },
  {
    name: 'styleVariants with mapper assigned to const',
    source: `import { styleVariants } from '@vanilla-extract/css';
const colors = styleVariants({
  red: 'red'
}, (color) => ({ color }));`,
    expected: `import { styleVariants } from '@vanilla-extract/css';
const colors = styleVariants({
  red: 'red'
}, (color) => ({ color }), "colors");`,
  },
  {
    name: 'style assigned to default export',
    source: `import { style } from '@vanilla-extract/css';
export default style({
  zIndex: 2,
});`,
    expected: `import { style } from '@vanilla-extract/css';
export default style({
  zIndex: 2,
}, "default");`,
  },
  {
    name: 'style assigned to object property',
    source: `import { style } from '@vanilla-extract/css';
const test = {
  one: {
    two: style({
      zIndex: 2,
    })
  }
};`,
    expected: `import { style } from '@vanilla-extract/css';
const test = {
  one: {
    two: style({
      zIndex: 2,
    }, "test_one_two")
  }
};`,
  },
  {
    name: 'style returned from an arrow function',
    source: `import { style } from '@vanilla-extract/css';
const test = () => {
  return style({
    color: 'red'
  });
};`,
    expected: `import { style } from '@vanilla-extract/css';
const test = () => {
  return style({
    color: 'red'
  }, "test");
};`,
  },
  {
    name: 'style returned implicitly from an arrow function',
    source: `import { style } from '@vanilla-extract/css';
const test = () => style({
  color: 'red'
});`,
    expected: `import { style } from '@vanilla-extract/css';
const test = () => style({
  color: 'red'
}, "test");`,
  },
  {
    name: 'style returned from a function',
    source: `import { style } from '@vanilla-extract/css';
function test() {
  return style({
    color: 'red'
  });
}`,
    expected: `import { style } from '@vanilla-extract/css';
function test() {
  return style({
    color: 'red'
  }, "test");
}`,
  },
  {
    name: 'globalStyle (not debuggable)',
    source: `import { globalStyle } from '@vanilla-extract/css';
globalStyle('html, body', { margin: 0 });`,
  },
  {
    name: 'createVar assigned to const',
    source: `import { createVar } from '@vanilla-extract/css';
const myVar = createVar();`,
    expected: `import { createVar } from '@vanilla-extract/css';
const myVar = createVar("myVar");`,
  },
  {
    name: 'typed createVar assigned to const',
    source: `import { createVar } from '@vanilla-extract/css';
const myVar = createVar({ syntax: '*', inherits: true });`,
    expected: `import { createVar } from '@vanilla-extract/css';
const myVar = createVar({ syntax: '*', inherits: true }, "myVar");`,
  },
  {
    name: 'createContainer assigned to const',
    source: `import { createContainer } from '@vanilla-extract/css';
const myContainer = createContainer();`,
    expected: `import { createContainer } from '@vanilla-extract/css';
const myContainer = createContainer("myContainer");`,
  },
  {
    name: 'createViewTransition assigned to const',
    source: `import { createViewTransition } from '@vanilla-extract/css';
const myViewTransition = createViewTransition();`,
    expected: `import { createViewTransition } from '@vanilla-extract/css';
const myViewTransition = createViewTransition("myViewTransition");`,
  },
  {
    name: 'fontFace assigned to const',
    source: `import { fontFace } from '@vanilla-extract/css';
const myFont = fontFace({
  src: 'local("Comic Sans MS")',
});`,
    expected: `import { fontFace } from '@vanilla-extract/css';
const myFont = fontFace({
  src: 'local("Comic Sans MS")',
}, "myFont");`,
  },
  {
    name: 'globalFontFace (not debuggable)',
    source: `import { globalFontFace } from '@vanilla-extract/css';
globalFontFace('myFont', {
  src: 'local("Comic Sans MS")',
});`,
  },
  {
    name: 'keyframes assigned to const',
    source: `import { keyframes } from '@vanilla-extract/css';
const myAnimation = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' }
});`,
    expected: `import { keyframes } from '@vanilla-extract/css';
const myAnimation = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' }
}, "myAnimation");`,
  },
  {
    name: 'globalKeyframes (not debuggable)',
    source: `import { globalKeyframes } from '@vanilla-extract/css';
globalKeyframes('myKeyframes', {
  from: { transform: 'rotate(0deg)' }
});`,
  },
  {
    name: 'layer assigned to const',
    source: `import { layer } from '@vanilla-extract/css';
const autoDebugId = layer();
const providedDebugId = layer('utils');`,
    expected: `import { layer } from '@vanilla-extract/css';
const autoDebugId = layer("autoDebugId");
const providedDebugId = layer('utils');`,
  },
  {
    name: 'layer assigned to a variable',
    source: `import { layer } from '@vanilla-extract/css';
let reset;
reset = layer();`,
    expected: `import { layer } from '@vanilla-extract/css';
let reset;
reset = layer("reset");`,
  },
  {
    name: 'layer with a parent',
    source: `import { layer } from '@vanilla-extract/css';
const reset = layer({ parent: 'papa' });
const providedDebugId = layer({ parent: 'papa' }, 'utils');`,
    expected: `import { layer } from '@vanilla-extract/css';
const reset = layer({ parent: 'papa' }, "reset");
const providedDebugId = layer({ parent: 'papa' }, 'utils');`,
  },
  {
    name: 'globalLayer (not debuggable)',
    source: `import { globalLayer } from '@vanilla-extract/css';
globalLayer('reset');
const reset = globalLayer({ parent: 'papa' }, 'my-reset');`,
  },
  {
    name: 'createTheme assigned to const',
    source: `import { createTheme } from '@vanilla-extract/css';
const darkTheme = createTheme({}, {});`,
    expected: `import { createTheme } from '@vanilla-extract/css';
const darkTheme = createTheme({}, {}, "darkTheme");`,
  },
  {
    name: 'createTheme using destructuring',
    source: `import { createTheme } from '@vanilla-extract/css';
const [theme, vars] = createTheme({}, {});`,
    expected: `import { createTheme } from '@vanilla-extract/css';
const [theme, vars] = createTheme({}, {}, "theme");`,
  },
  {
    name: 'createGlobalTheme (not debuggable)',
    source: `import { createGlobalTheme } from '@vanilla-extract/css';
const vars = createGlobalTheme(':root', { foo: 'bar' });`,
  },
  {
    name: 'createThemeContract (not debuggable)',
    source: `import { createThemeContract } from '@vanilla-extract/css';
const vars = createThemeContract({
  foo: 'bar'
});`,
  },
  {
    name: 'recipe assigned to const',
    source: `import { recipe } from '@vanilla-extract/recipes';
const button = recipe({});`,
    expected: `import { recipe } from '@vanilla-extract/recipes';
const button = recipe({}, "button");`,
  },
  {
    name: 'functions that already supply a debug name',
    source: `import { style, styleVariants } from '@vanilla-extract/css';
const three = style({
  testStyle: {
    zIndex: 2,
  }
}, 'myDebugValue');
const four = styleVariants({
  red: { color: 'red' }
}, 'myDebugValue');
const fourTemplate = styleVariants({
  red: { color: 'red' }
}, \`myDebugValue_\${i}\`);`,
  },
  {
    name: 'functions imported from an irrelevant package',
    source: `import { style } from 'some-other-package';
const three = style({
  zIndex: 2,
});`,
  },
  {
    name: 'renamed imports',
    source: `import { style as specialStyle } from '@vanilla-extract/css';
const four = specialStyle({
  zIndex: 2,
});`,
    expected: `import { style as specialStyle } from '@vanilla-extract/css';
const four = specialStyle({
  zIndex: 2,
}, "four");`,
  },
  {
    name: 'anonymous style in arrays',
    source: `import { style } from '@vanilla-extract/css';
export const height = [
  style({
    zIndex: 2,
  })
];`,
    expected: `import { style } from '@vanilla-extract/css';
export const height = [
  style({
    zIndex: 2,
  }, "height")
];`,
  },
  {
    name: 'object key with anonymous style in arrays',
    source: `import { style } from '@vanilla-extract/css';
export const height = {
  full: [style({
    zIndex: 2,
  })]
};`,
    expected: `import { style } from '@vanilla-extract/css';
export const height = {
  full: [style({
    zIndex: 2,
  }, "height_full")]
};`,
  },
  {
    name: 'namespace imports',
    source: `import * as css from '@vanilla-extract/css';
const one = css.style({
  zIndex: 2,
});`,
    expected: `import * as css from '@vanilla-extract/css';
const one = css.style({
  zIndex: 2,
}, "one");`,
  },
  {
    name: 'nested call expressions',
    source: `import { style } from '@vanilla-extract/css';
const one = instrument(style({
  zIndex: 1,
}));
const two = instrument(instrument(style({
  zIndex: 2,
})));
const three = instrument(instrument(instrument(style({
  zIndex: 3,
}))));`,
    expected: `import { style } from '@vanilla-extract/css';
const one = instrument(style({
  zIndex: 1,
}, "one"));
const two = instrument(instrument(style({
  zIndex: 2,
}, "two")));
const three = instrument(instrument(instrument(style({
  zIndex: 3,
}, "three"))));`,
  },
  {
    name: 'instrumentation via sequence expressions',
    source: `import { style } from '@vanilla-extract/css';
const one = (something++, style({
  zIndex: 1,
}));`,
    expected: `import { style } from '@vanilla-extract/css';
const one = (something++, style({
  zIndex: 1,
}, "one"));`,
  },
  {
    name: 'trailing comma in the call arguments',
    source: `import { style } from '@vanilla-extract/css';
const one = style({
  zIndex: 2,
},);`,
    expected: `import { style } from '@vanilla-extract/css';
const one = style({
  zIndex: 2,
}, "one",);`,
  },
  {
    name: 'TypeScript annotations and non-ASCII content',
    source: `import { style } from '@vanilla-extract/css';
const emoji = '💅';
export const box: string = style({
  content: emoji,
});`,
    expected: `import { style } from '@vanilla-extract/css';
const emoji = '💅';
export const box: string = style({
  content: emoji,
}, "box");`,
  },
]

describe.each(parsers)('injectDebugIds via %s', (_parserName, parse) => {
  const transform = (source: string) => injectDebugIds(source, parse(source))

  it('should not crash when using `satisfies` operator', () => {
    const source = `const dummy = {} satisfies {};`
    expect(() => transform(source)).not.toThrow()
    expect(transform(source)).toBe(source)
  })

  it.each(cases)('should handle $name', ({source, expected}) => {
    expect(transform(source)).toBe(expected ?? source)
  })
})
