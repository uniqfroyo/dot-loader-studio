import type { LoaderDefinition } from './index';

export interface SpinOptions {
  /** Text shown after the spinner. */
  text?: string;
  /** Brightness at which a dot is raised. Default 0.5. */
  threshold?: number;
  /** Tint with the loader's first color (hex colors, TTY only). Default true. */
  color?: boolean;
  /** Output stream. Default process.stderr. */
  stream?: NodeJS.WriteStream;
}

export interface Spinner {
  frames: string[];
  setText(text: string): void;
  /** Stop, clear the spinner and optionally print a final line. */
  stop(finalText?: string): void;
}

export declare function spin(def: LoaderDefinition, options?: SpinOptions): Spinner;
