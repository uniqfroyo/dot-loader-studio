/**
 * dot-loader-studio — runtime for loaders designed in Dot Loader Studio.
 * Framework-agnostic and dependency-free. Safe to import during SSR.
 */

export const FORMAT = 'dot-loader/v1';

export const SHAPES = ['circle', 'rounded', 'square', 'diamond', 'ring', 'plus', 'hex'];

const POLY = {
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  plus: [[0.34, 0], [0.66, 0], [0.66, 0.34], [1, 0.34], [1, 0.66], [0.66, 0.66], [0.66, 1], [0.34, 1], [0.34, 0.66], [0, 0.66], [0, 0.34], [0.34, 0.34]],
  hex: [[0.25, 0.067], [0.75, 0.067], [1, 0.5], [0.75, 0.933], [0.25, 0.933], [0, 0.5]],
};
const RADIUS = { circle: '50%', ring: '50%', rounded: '28%' };
const clipPath = shape => POLY[shape]
  ? `polygon(${POLY[shape].map(([x, y]) => `${+(x * 100).toFixed(1)}% ${+(y * 100).toFixed(1)}%`).join(', ')})`
  : undefined;

const DEFAULTS = { interval: 80, colors: ['currentColor'], base: 0.15, shape: 'circle', size: 8, gap: 3, glow: false, scale: false, smooth: false };
const FRAME_RE = /^[0-9a-f-]+$/i;
const isColor = c => typeof c === 'string' && c.length > 0;

/**
 * Validate a loader definition and fill in defaults. Throws a descriptive error when invalid.
 * @param {import('./index').LoaderDefinition} def
 * @returns {import('./index').ResolvedLoader}
 */
export function validate(def) {
  const fail = msg => { throw new TypeError(`[dot-loader-studio] ${msg}`); };
  if (!def || typeof def !== 'object') fail('loader must be an object');
  if (def.format !== undefined && def.format !== FORMAT) fail(`unsupported format "${def.format}", expected "${FORMAT}"`);
  const cols = def.cols, rows = def.rows;
  if (!Number.isInteger(cols) || cols < 1 || cols > 64) fail('"cols" must be an integer between 1 and 64');
  if (!Number.isInteger(rows) || rows < 1 || rows > 64) fail('"rows" must be an integer between 1 and 64');
  if (!Array.isArray(def.frames) || def.frames.length === 0) fail('"frames" must be a non-empty array of strings');
  def.frames.forEach((f, i) => {
    if (typeof f !== 'string' || f.length !== cols * rows || !FRAME_RE.test(f))
      fail(`frame ${i} must be a string of ${cols * rows} characters using 0-9, a-f or "-"`);
  });
  const out = { ...DEFAULTS, ...def, format: FORMAT };
  if (!(out.interval > 0)) fail('"interval" must be a positive number of milliseconds');
  if (!Array.isArray(out.colors) || !out.colors.length || !out.colors.every(isColor)) fail('"colors" must be a non-empty array of CSS colors');
  if (!SHAPES.includes(out.shape)) fail(`"shape" must be one of ${SHAPES.join(', ')}`);
  if (!(out.base >= 0 && out.base <= 1)) fail('"base" must be between 0 and 1');
  return out;
}

/** Brightness of one encoded dot: -1 = hidden, otherwise 0..1. */
export function decodeDot(ch) {
  return ch === '-' ? -1 : parseInt(ch, 16) / 15;
}

/** Index of the frame to show after `elapsed` milliseconds. */
export function frameAt(loader, elapsed) {
  return Math.floor(Math.max(0, elapsed) / loader.interval) % loader.frames.length;
}

/** Total loop duration in milliseconds. */
export function duration(loader) {
  return loader.interval * loader.frames.length;
}

/**
 * Convert every frame to Unicode braille (U+2800–U+28FF). Each braille character covers
 * 2×4 dots, so a grid wider than 2 or taller than 4 becomes several characters / lines.
 * @param {import('./index').LoaderDefinition} def
 * @param {{ threshold?: number }} [options] dots at or above this brightness are raised (default 0.5)
 * @returns {string[]} one string per frame; multi-line frames are joined with "\n"
 */
export function toBraille(def, { threshold = 0.5 } = {}) {
  const { cols, rows, frames } = validate(def);
  return frames.map(f => brailleFrame(f, cols, rows, threshold));
}

// braille dot bits, indexed [row][col] inside a 2×4 cell
const BRAILLE_BITS = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
export function brailleFrame(frame, cols, rows, threshold = 0.5) {
  const lines = [];
  for (let by = 0; by < rows; by += 4) {
    let line = '';
    for (let bx = 0; bx < cols; bx += 2) {
      let bits = 0;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) {
        const x = bx + dx, y = by + dy;
        if (x < cols && y < rows && decodeDot(frame[y * cols + x]) >= threshold) bits |= BRAILLE_BITS[dy][dx];
      }
      line += String.fromCharCode(0x2800 + bits);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Inline style for the grid container. */
export function containerStyle(loader, size = loader.size, gap = loader.gap) {
  const style = { display: 'inline-grid', gridTemplateColumns: `repeat(${loader.cols}, ${size}px)`, gap: `${gap}px` };
  if (loader.glow) style.filter = `drop-shadow(0 0 ${size * 0.5}px ${loader.colors[0]})`;
  return style;
}

/** Inline style for dot `i` at brightness `v` (-1 = hidden). */
export function dotStyle(loader, i, v, size = loader.size) {
  const color = loader.colors[i % loader.colors.length];
  const style = {
    width: `${size}px`, height: `${size}px`,
    opacity: v < 0 ? 0 : loader.base + (1 - loader.base) * v,
  };
  if (RADIUS[loader.shape]) style.borderRadius = RADIUS[loader.shape];
  const clip = clipPath(loader.shape);
  if (clip) style.clipPath = clip;
  if (loader.shape === 'ring') style.boxShadow = `inset 0 0 0 ${size * 0.24}px ${color}`;
  else style.background = color;
  if (loader.scale) style.transform = `scale(${v < 0 ? 0 : 0.4 + 0.6 * v})`;
  if (loader.smooth) style.transition = `opacity ${loader.interval}ms linear, transform ${loader.interval}ms linear`;
  return style;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Render a loader into a DOM element. Returns a handle with `destroy()`.
 * @param {HTMLElement} el
 * @param {import('./index').LoaderDefinition} def
 * @param {{ size?: number, gap?: number, label?: string }} [options]
 */
export function mount(el, def, { size, gap, label = 'Loading' } = {}) {
  const loader = validate(def);
  size = size ?? loader.size;
  gap = gap ?? (size * loader.gap) / loader.size;
  const root = document.createElement('div');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', label);
  Object.assign(root.style, containerStyle(loader, size, gap));
  const dots = [...loader.frames[0]].map(() => root.appendChild(document.createElement('span')));
  el.appendChild(root);

  const reduce = prefersReducedMotion();
  const start = performance.now();
  let last = -1, raf = 0;
  const render = () => {
    const f = reduce ? 0 : frameAt(loader, performance.now() - start);
    if (f !== last) {
      last = f;
      const frame = loader.frames[f];
      dots.forEach((d, i) => Object.assign(d.style, dotStyle(loader, i, decodeDot(frame[i]), size)));
    }
    if (!reduce) raf = requestAnimationFrame(render);
  };
  render();
  return { element: root, destroy() { cancelAnimationFrame(raf); root.remove(); } };
}
