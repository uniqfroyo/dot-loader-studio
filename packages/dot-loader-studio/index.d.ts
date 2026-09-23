export declare const FORMAT: 'dot-loader/v1';

export type DotShape = 'circle' | 'rounded' | 'square' | 'diamond' | 'ring' | 'plus' | 'hex';
export declare const SHAPES: DotShape[];

/**
 * A loader exported from Dot Loader Studio ("dot-loader/v1").
 * Each frame is a string of `cols * rows` characters, row by row:
 * `0`–`f` is the dot brightness (0 = idle, f = full), `-` hides the dot.
 */
export interface LoaderDefinition {
  format?: 'dot-loader/v1';
  cols: number;
  rows: number;
  frames: string[];
  /** Milliseconds per frame. Default 80. */
  interval?: number;
  /** One color for all dots, or one per dot. Default ["currentColor"]. */
  colors?: string[];
  /** Opacity of an idle (brightness 0) dot, 0–1. Default 0.15. */
  base?: number;
  shape?: DotShape;
  /** Default dot size in px. Default 8. */
  size?: number;
  /** Default gap in px. Default 3. */
  gap?: number;
  glow?: boolean;
  /** Shrink dots as they dim. */
  scale?: boolean;
  /** Cross-fade between frames. */
  smooth?: boolean;
}

export type ResolvedLoader = Required<LoaderDefinition>;

export declare function validate(def: LoaderDefinition): ResolvedLoader;
export declare function decodeDot(ch: string): number;
export declare function frameAt(loader: ResolvedLoader, elapsed: number): number;
export declare function duration(loader: ResolvedLoader): number;
export declare function toBraille(def: LoaderDefinition, options?: { threshold?: number }): string[];
export declare function brailleFrame(frame: string, cols: number, rows: number, threshold?: number): string;
export declare function containerStyle(loader: ResolvedLoader, size?: number, gap?: number): Record<string, string>;
export declare function dotStyle(loader: ResolvedLoader, i: number, v: number, size?: number): Record<string, string | number>;

export interface MountOptions {
  size?: number;
  gap?: number;
  label?: string;
}
export declare function mount(el: HTMLElement, def: LoaderDefinition, options?: MountOptions): {
  element: HTMLDivElement;
  destroy(): void;
};
