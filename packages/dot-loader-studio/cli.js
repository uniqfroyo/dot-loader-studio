#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validate, toBraille } from './index.js';
import { spin } from './terminal.js';

const HELP = `Usage: dot-loader-studio <loader.json> [options]

Play a loader exported from Dot Loader Studio as a braille spinner.

Options:
  --text <label>       text shown next to the spinner (default: "Thinking…")
  --threshold <0-1>    brightness at which a dot is raised (default: 0.5)
  --frames             print the braille frames as JSON and exit
  --no-color           don't tint the spinner with the loader color
  -h, --help           show this help`;

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  console.log(HELP);
  process.exit(args.length ? 0 : 1);
}
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('-') && !['--text', '--threshold'].includes(args[i - 1]));

let loader;
try {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  loader = validate(json.loader ?? json);
} catch (err) {
  console.error(`dot-loader-studio: ${err.message}`);
  process.exit(1);
}
const threshold = opt('--threshold') !== undefined ? Number(opt('--threshold')) : 0.5;

if (args.includes('--frames')) {
  console.log(JSON.stringify(toBraille(loader, { threshold }), null, 2));
} else {
  const s = spin(loader, { text: opt('--text') ?? 'Thinking…', threshold, color: !args.includes('--no-color'), stream: process.stdout });
  const quit = () => { s.stop(); process.exit(0); };
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
}
