# dot-loader-studio

Runtime for dot-matrix loading animations designed in **[Dot Loader Studio](https://uniqfroyo.github.io/dot-loader-studio/)**.
It plays the same loader in the DOM, in React, and as Unicode braille in a terminal. No dependencies; React is an optional peer.

```bash
npm install dot-loader-studio
```

## 1. Design and export

Open the [editor](https://uniqfroyo.github.io/dot-loader-studio/), design a loader, then open **复制代码 → npm 包** and click **下载 loader.json**.

## 2. Use it

**React**

```tsx
import { DotLoader } from "dot-loader-studio/react";
import loader from "./loader.json";

export function Thinking() {
  return <DotLoader loader={loader} size={6} label="Thinking" />;
}
```

Define or import `loader` outside the component so it keeps the same identity between renders. The file starts with `"use client"`, so it works in the Next.js App Router.

| Prop | Default | |
| --- | --- | --- |
| `loader` | — | The loader definition (required) |
| `size` | designed size | Dot size in px |
| `gap` | scales with `size` | Gap in px |
| `label` | `"Loading"` | Accessible label (`role="status"`) |
| `className`, `style` | — | Passed to the root element |

**Plain JavaScript**

```js
import { mount } from "dot-loader-studio";

const handle = mount(document.querySelector("#loader"), loader, { size: 6 });
// later
handle.destroy();
```

**Terminal (Node.js)**

```js
import { spin } from "dot-loader-studio/terminal";

const spinner = spin(loader, { text: "Thinking…" });
await doWork();
spinner.stop("✔ Done");
```

**CLI**

```bash
npx dot-loader-studio loader.json --text "Thinking…"
npx dot-loader-studio loader.json --frames      # print braille frames as JSON
```

**Braille strings only**

```js
import { toBraille } from "dot-loader-studio";

toBraille(loader, { threshold: 0.5 }); // ["⠁⠄", "⠃⠆", …]
```

Each braille character covers 2×4 dots, so a 2×4 grid is one character and a 4×4 grid is two. Taller grids span several lines, joined with `\n`. A dot is raised when its brightness is at or above `threshold`.

All loaders respect `prefers-reduced-motion`: they show the first frame and don't animate.

## The `dot-loader/v1` format

```jsonc
{
  "format": "dot-loader/v1",
  "cols": 3,
  "rows": 3,
  "interval": 80,          // ms per frame
  "frames": [              // one string per frame, row by row
    "f00000000",           // 0–f = brightness, "-" = hidden
    "0f0000000"
  ],
  "colors": ["#a78bfa"],   // one color, or one per dot
  "base": 0.15,            // opacity of an idle dot
  "shape": "circle",       // circle | rounded | square | diamond | ring | plus | hex
  "size": 8,               // designed dot size (px)
  "gap": 3,                // designed gap (px)
  "glow": false,
  "scale": false,          // shrink dots as they dim
  "smooth": false          // cross-fade between frames
}
```

Only `cols`, `rows` and `frames` are required. `validate(def)` checks a definition, fills in defaults and throws a readable error if something is wrong.

## API

| Export | |
| --- | --- |
| `validate(def)` | Check a definition and fill in defaults |
| `mount(el, def, options?)` | Render into a DOM element, returns `{ element, destroy }` |
| `toBraille(def, { threshold? })` | Frames as braille strings |
| `frameAt(loader, elapsedMs)`, `duration(loader)` | Timing helpers |
| `containerStyle`, `dotStyle`, `decodeDot` | Building blocks for your own renderer |
| `dot-loader-studio/react` → `DotLoader` | React component |
| `dot-loader-studio/terminal` → `spin(def, options?)` | Terminal spinner with `setText` and `stop` |

## License

MIT
