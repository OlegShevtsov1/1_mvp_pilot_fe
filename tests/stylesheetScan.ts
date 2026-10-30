import { readdirSync } from 'node:fs'
import { join, posix } from 'node:path'

export interface Violation {
  file: string
  selector: string
  declaration: string
  rule: 'colour' | 'length' | 'motion'
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: no-preference)'

const NAMED_COLOURS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk',
  'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral',
  'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime',
  'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
  'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue',
  'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
  'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown',
  'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray',
  'slategrey', 'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
  'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
]

const COLOUR = new RegExp(
  `#[0-9a-f]{3,8}\\b|(?<![\\w-])(?:rgba?|hsla?|hwb)\\(|(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`,
  'i',
)

const LENGTH_PROPERTY =
  /^(?:font-size|margin|padding|gap|row-gap|column-gap|inset|border-radius|box-shadow|text-shadow|(?:margin|padding|inset)-[a-z-]+|border-[a-z]+-[a-z]+-radius)$/

const LENGTH = /(?<![\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|r?em|ex|ch|v[hw]|vmin|vmax|[sld]v[hw]|pt|pc|cm|mm|in|q)\b/gi

const MOTION_PROPERTY = /^(?:animation|transition)(?:-[a-z-]+)?$/

const isZero = (length: string): boolean => parseFloat(length) === 0

/** Pattern scan of one stylesheet: raw colours, raw lengths in the guarded properties, and motion outside reduced motion. */
export function scanStylesheet(file: string, css: string): Violation[] {
  const found: Violation[] = []
  const stack: { prelude: string; rule: boolean }[] = []
  const top = (): { prelude: string; rule: boolean } | undefined => stack[stack.length - 1]
  let buffer = ''

  const inspect = (text: string): void => {
    const colon = text.indexOf(':')
    if (colon < 0) return
    const property = text.slice(0, colon).trim().toLowerCase()
    const value = text.slice(colon + 1).trim()
    if (!property || !value) return
    const declaration = `${property}: ${value.replace(/\s+/g, ' ')}`
    const selector = stack[stack.length - 1].prelude
    const report = (rule: Violation['rule']): void => {
      found.push({ file, selector, declaration, rule })
    }

    if (COLOUR.test(value)) report('colour')
    if (LENGTH_PROPERTY.test(property) && (value.match(LENGTH) ?? []).some((length) => !isZero(length))) report('length')
    if (MOTION_PROPERTY.test(property) && !stack.some((frame) => frame.prelude === REDUCED_MOTION)) report('motion')
  }

  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const prelude = buffer.trim().replace(/\s+/g, ' ')
      stack.push({ prelude: prelude.startsWith('@') ? prelude.toLowerCase() : prelude, rule: !prelude.startsWith('@') })
      buffer = ''
    } else if (char === ';') {
      if (top()?.rule) inspect(buffer)
      buffer = ''
    } else if (char === '}') {
      if (top()?.rule) inspect(buffer)
      stack.pop()
      buffer = ''
    } else {
      buffer += char
    }
  }
  return found
}

export function formatViolation({ file, selector, declaration, rule }: Violation): string {
  const reason = {
    colour: 'raw colour: use a var(--color-…) design value',
    length: 'raw length: use a var(--…) design value',
    motion: 'animation or transition outside @media (prefers-reduced-motion: no-preference)',
  }[rule]
  return `${file}: ${selector} { ${declaration} } — ${reason}`
}

/** Every `.css` file under `dir` (relative to `root`), as sorted repository paths with forward slashes. */
export function stylesheetsUnder(root: string, dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const path = posix.join(dir, entry.name)
      if (entry.isDirectory()) return stylesheetsUnder(root, path)
      return entry.name.endsWith('.css') ? [path] : []
    })
    .sort()
}
