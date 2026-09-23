import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { validate, toBraille, brailleFrame, frameAt, dotStyle, decodeDot } from '../index.js';
import { spin } from '../terminal.js';

const threeByThree = { cols: 3, rows: 3, interval: 100, frames: ['f0000000f', '---------'] };

test('validate fills defaults and rejects bad input', () => {
  const l = validate(threeByThree);
  assert.equal(l.format, 'dot-loader/v1');
  assert.equal(l.shape, 'circle');
  assert.deepEqual(l.colors, ['currentColor']);
  assert.throws(() => validate({ ...threeByThree, frames: ['f00'] }), /frame 0/);
  assert.throws(() => validate({ ...threeByThree, frames: ['zzzzzzzzz'] }), /frame 0/);
  assert.throws(() => validate({ ...threeByThree, shape: 'blob' }), /shape/);
  assert.throws(() => validate({ ...threeByThree, format: 'other/v9' }), /format/);
});

test('decodeDot maps hex brightness and hidden', () => {
  assert.equal(decodeDot('0'), 0);
  assert.equal(decodeDot('f'), 1);
  assert.equal(decodeDot('-'), -1);
});

test('frameAt loops over frames', () => {
  const l = validate(threeByThree);
  assert.equal(frameAt(l, 0), 0);
  assert.equal(frameAt(l, 150), 1);
  assert.equal(frameAt(l, 250), 0);
});

test('braille maps each 2x4 block to one character', () => {
  // 2×4 grid, every dot lit → full braille block
  assert.equal(brailleFrame('ffffffff', 2, 4), '⣿');
  // only top-left → dot 1
  assert.equal(brailleFrame('f0000000', 2, 4), '⠁');
  // only bottom-right → dot 8
  assert.equal(brailleFrame('0000000f', 2, 4), '⢀');
  // hidden and dim dots stay flat
  assert.equal(brailleFrame('--------', 2, 4), '⠀');
  assert.equal(brailleFrame('7777777', 2, 4).length, 1);
});

test('braille splits wide and tall grids', () => {
  const frames = toBraille(threeByThree);
  // 3×3 → 2 characters wide, 1 line tall
  assert.equal(frames[0], '⠁⠄');
  assert.equal(frames[1], '⠀⠀');
  const tall = toBraille({ cols: 2, rows: 5, frames: ['f'.repeat(10)] });
  assert.equal(tall[0], '⣿\n⠉');
});

test('threshold controls which dots are raised', () => {
  const def = { cols: 2, rows: 1, frames: ['8f'] };
  assert.equal(toBraille(def, { threshold: 0.5 })[0], '⠉');
  assert.equal(toBraille(def, { threshold: 0.9 })[0], '⠈');
});

test('dotStyle reflects shape and brightness', () => {
  const l = validate({ ...threeByThree, shape: 'ring', colors: ['#ff0000'], base: 0.2 });
  const s = dotStyle(l, 0, 1, 10);
  assert.equal(s.opacity, 1);
  assert.equal(s.borderRadius, '50%');
  assert.match(s.boxShadow, /#ff0000/);
  assert.equal(dotStyle(l, 0, -1, 10).opacity, 0);
  assert.equal(dotStyle(l, 0, 0, 10).opacity, 0.2);
});

test('terminal spinner writes frames and clears on stop', async () => {
  const stream = new PassThrough();
  let out = '';
  stream.on('data', d => { out += d; });
  const s = spin({ ...threeByThree, interval: 10 }, { text: 'Working', stream, color: false });
  await new Promise(r => setTimeout(r, 35));
  s.stop('done');
  assert.match(out, /⠁⠄ Working/);
  assert.match(out, /done\n$/);
});
