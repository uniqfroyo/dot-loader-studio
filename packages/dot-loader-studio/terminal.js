import { validate, toBraille } from './index.js';

const ESC = '\x1b[';
const hexToAnsi = hex => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '';
  const n = parseInt(m[1], 16);
  return `${ESC}38;2;${n >> 16 & 255};${n >> 8 & 255};${n & 255}m`;
};

/**
 * Play a loader as a braille spinner in a terminal (Node.js).
 * @param {import('./index').LoaderDefinition} def
 * @param {import('./terminal').SpinOptions} [options]
 * @returns {import('./terminal').Spinner}
 */
export function spin(def, { text = '', threshold = 0.5, color = true, stream = process.stderr } = {}) {
  const loader = validate(def);
  const frames = toBraille(loader, { threshold });
  const height = frames[0].split('\n').length;
  const tint = color && stream.isTTY ? hexToAnsi(loader.colors[0]) : '';
  const reset = tint ? `${ESC}0m` : '';
  let i = 0, drawn = false, label = text;

  const draw = () => {
    const lines = frames[i++ % frames.length].split('\n');
    let out = drawn && height > 1 ? `${ESC}${height - 1}A` : '';
    lines.forEach((line, k) => {
      out += `\r${ESC}2K${tint}${line}${reset}`;
      if (k === 0 && label) out += ` ${label}`;
      if (k < lines.length - 1) out += '\n';
    });
    stream.write(out);
    drawn = true;
  };
  const clear = () => {
    if (!drawn) return;
    let out = `\r${ESC}2K`;
    for (let k = 1; k < height; k++) out += `${ESC}1A\r${ESC}2K`;
    stream.write(out);
    drawn = false;
  };

  if (stream.isTTY) stream.write(`${ESC}?25l`);
  draw();
  const timer = setInterval(draw, loader.interval);
  let stopped = false;
  return {
    frames,
    setText(t) { label = t; },
    stop(finalText) {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      clear();
      if (stream.isTTY) stream.write(`${ESC}?25h`);
      if (finalText) stream.write(finalText + '\n');
    },
  };
}
